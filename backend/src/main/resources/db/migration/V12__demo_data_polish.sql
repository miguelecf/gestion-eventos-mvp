SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @now = NOW(6);

SET @u_full = (SELECT id FROM users WHERE username = 'admin.full');
SET @u_cer = (SELECT id FROM users WHERE username = 'admin.ceremonial');
SET @u_tec = (SELECT id FROM users WHERE username = 'admin.tecnica');
SET @viewer = (SELECT id FROM users WHERE username = 'viewer');

SET @event_apertura = (SELECT id FROM events WHERE name = 'Acto de Apertura Académica' ORDER BY id DESC LIMIT 1);
SET @event_cine = (SELECT id FROM events WHERE name = 'Ciclo de Cine Latinoamericano' ORDER BY id DESC LIMIT 1);
SET @event_salud = (SELECT id FROM events WHERE name = 'Jornada de Salud Comunitaria' ORDER BY id DESC LIMIT 1);
SET @event_conflict = (SELECT id FROM events WHERE name = 'Rectorado - Evento Alta Prioridad' ORDER BY id DESC LIMIT 1);
SET @comment_event = COALESCE(@event_apertura, (SELECT id FROM events ORDER BY id LIMIT 1));

UPDATE event_requests
SET reviewed_at = DATE_SUB(@now, INTERVAL 2 DAY),
    reviewed_by = 'Admin Ceremonial'
WHERE tracking_uuid IN (
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440009'
);

UPDATE event_requests
SET reviewed_at = DATE_SUB(@now, INTERVAL 4 DAY),
    reviewed_by = 'Admin Full'
WHERE tracking_uuid IN (
  '550e8400-e29b-41d4-a716-446655440006',
  '550e8400-e29b-41d4-a716-446655440011'
);

INSERT INTO event_comments (
  active, created_at, updated_at, event_id, author_id, edited_by_user_id, body, visibility
) VALUES
  (b'1', DATE_SUB(@now, INTERVAL 3 DAY), DATE_SUB(@now, INTERVAL 3 DAY), @comment_event, @u_cer, NULL,
   'Ceremonial confirma protocolo de ingreso, atril y ubicacion de autoridades.', 'INTERNAL'),
  (b'1', DATE_SUB(@now, INTERVAL 2 DAY), DATE_SUB(@now, INTERVAL 2 DAY), @comment_event, @u_tec, NULL,
   'Tecnica solicita prueba de sonido 45 minutos antes del inicio.', 'INTERNAL'),
  (b'1', DATE_SUB(@now, INTERVAL 1 DAY), DATE_SUB(@now, INTERVAL 1 DAY), COALESCE(@event_cine, @comment_event), @u_full, NULL,
   'Pendiente confirmar responsable de sala y material audiovisual final.', 'INTERNAL'),
  (b'1', DATE_SUB(@now, INTERVAL 8 HOUR), DATE_SUB(@now, INTERVAL 8 HOUR), COALESCE(@event_salud, @comment_event), @u_tec, NULL,
   'Para la jornada externa se requiere revisar acceso electrico y punto de red.', 'INTERNAL');

SET @comment_apertura = (
  SELECT id FROM event_comments
  WHERE event_id = @comment_event
  ORDER BY id LIMIT 1
);

INSERT INTO event_history (
  event_id, actor_user_id, field, reason, note, at, type, from_value, to_value, details
) VALUES
  (@comment_event, @u_full, 'status', 'Reserva inicial para agenda institucional', NULL,
   DATE_SUB(@now, INTERVAL 7 DAY), 'STATUS', NULL, 'RESERVADO', 'Evento creado y reservado por administracion.'),
  (@comment_event, @u_cer, 'ceremonialOk', 'Validacion de protocolo', 'Autoridades y ceremonial confirmados.',
   DATE_SUB(@now, INTERVAL 3 DAY), 'FIELD_UPDATE', 'false', 'true', 'Ceremonial aprobado.'),
  (@comment_event, @u_tec, 'comments', NULL, 'Se agrego requerimiento tecnico previo.',
   DATE_SUB(@now, INTERVAL 2 DAY), 'COMMENT_CREATED', NULL, NULL, 'Comentario interno agregado por tecnica.'),
  (COALESCE(@event_cine, @comment_event), @u_cer, 'status', 'Revision de sala audiovisual', NULL,
   DATE_SUB(@now, INTERVAL 2 DAY), 'STATUS', 'SOLICITADO', 'EN_REVISION', 'Solicitud interna enviada a revision.'),
  (COALESCE(@event_conflict, @comment_event), @u_full, 'priority', 'Evento de rectorado desplaza actividad de menor prioridad', NULL,
   DATE_SUB(@now, INTERVAL 1 DAY), 'PRIORITY_CONFLICT', 'LOW', 'HIGH', 'Conflicto de prioridad pendiente de resolucion.');

INSERT INTO notifications (
  active, created_at, updated_at, user_id, type, title, body, event_id, comment_id, is_read, read_at, action_url, metadata
) VALUES
  (b'1', DATE_SUB(@now, INTERVAL 3 DAY), DATE_SUB(@now, INTERVAL 3 DAY), @u_tec,
   'EVENT_STATUS_CHANGED', 'Evento reservado', 'Acto de Apertura Academica fue reservado y requiere validacion tecnica.',
   @comment_event, NULL, b'0', NULL, CONCAT('/events/', @comment_event), JSON_OBJECT('status', 'RESERVADO')),
  (b'1', DATE_SUB(@now, INTERVAL 2 DAY), DATE_SUB(@now, INTERVAL 2 DAY), @u_full,
   'NEW_COMMENT_ON_EVENT', 'Nuevo comentario interno', 'Tecnica agrego un comentario sobre prueba de sonido.',
   @comment_event, @comment_apertura, b'0', NULL, CONCAT('/events/', @comment_event, '/comments'), JSON_OBJECT('source', 'demo')),
  (b'1', DATE_SUB(@now, INTERVAL 1 DAY), DATE_SUB(@now, INTERVAL 1 DAY), @u_cer,
   'PRIORITY_CONFLICT_DETECTED', 'Conflicto de prioridad abierto', 'Hay un evento de alta prioridad pendiente de reprogramacion.',
   COALESCE(@event_conflict, @comment_event), NULL, b'0', NULL, '/priority-conflicts', JSON_OBJECT('conflictCode', 'PRIO-SEED-00001')),
  (b'1', DATE_SUB(@now, INTERVAL 6 HOUR), DATE_SUB(@now, INTERVAL 6 HOUR), @viewer,
   'EVENT_STATUS_CHANGED', 'Solicitud en revision', 'Tu solicitud publica fue tomada por el equipo administrativo.',
   COALESCE(@event_cine, @comment_event), NULL, b'1', DATE_SUB(@now, INTERVAL 5 HOUR), '/requests/tracking', JSON_OBJECT('status', 'EN_REVISION'));
