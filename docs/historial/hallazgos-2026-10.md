# Estado de corrección de hallazgos

> **Documento histórico, no normativo.** Conserva el registro del reporte y las correcciones efectuadas en su momento. Para reglas vigentes, consultar `docs/decisiones-funcionales.md`, `docs/permisos.md` y el código actual.

Fuente: el reporte "Errores Gestión de Eventos". Se atacaron de **menor a mayor complejidad**, con un commit por ID.

- **Estados registrados:** `pendiente` · `en curso` · `corregido` · `documentado` (decisión sin cambio de código) · `descartado`.
- **Decisiones funcionales:** ver `docs/decisiones-funcionales.md`.

## Notas de precisión al archivar
- El árbol local inspeccionado de `synthetic-user-engine/` contiene transiciones de eventos con `SOLICITADO`; no contiene referencias a `CANCELLED`. La carpeta está excluida de Git y se considera legacy, por lo que esto no acredita que sea un contrato vigente ni describe copias fuera del checkout.
- `backend/src/main/resources/db/migration/V2__seed.sql` comenta la contraseña de demo `admin123` y guarda su hash BCrypt en los usuarios sembrados. Este documento no verifica que esas credenciales funcionen en un entorno actual.

## Verificación final (5.7)
Docker limpio con un proyecto aislado (`-p gestion-eventos-mvp-check`), ya dado de baja con `down -v`:
- Flyway aplicó V1 a V14 sobre MySQL 8.
- Smoke por nginx:
  - alta y seguimiento público;
  - 403 en el listado público y en `/admin` sin login;
  - bandeja admin, revisión y conversión con soporte técnico;
  - un comentario interno no aparece en el seguimiento;
  - USUARIO recibe 403 al editar y 200 al leer eventos y catálogos;
  - ADMIN_TECNICA recibe 403 al resolver conflictos;
  - la baja queda auditada.
- Mailpit recibió confirmación, revisión y conversión.
- Carrera de dos reservas con un cupo: una 200 y otra 409.
- Backend: 39 tests en verde. Frontend: build OK; el lint bajó de 66 a 63 errores.

## Hallazgos adicionales detectados durante la corrección
- **2.7-bis:** al loguearse con contraseña temporal, el frontend ignoraba `mustChangePassword` y entraba con un token que sólo sirve para cambiar la contraseña, así que todas las pantallas daban 403. Además, `currentPassword` podía omitirse si la contraseña no era temporal. Corregido en el mismo commit que 2.7.
- **2.1-bis:** el tracking esperaba el estado `SOLICITADO` en la solicitud, pero el backend usa `RECIBIDO`. Si un evento convertido terminaba `RECHAZADO`, la página igual decía "Aprobada". Corregido en 2.1.
- **3.3-bis:** la UI sólo permitía dar de baja eventos en estado `SOLICITADO`, que nunca existe, así que la baja era imposible desde la interfaz. Ahora depende del permiso del rol. Corregido en 3.3. *Decisión asumida: la baja se permite en cualquier estado para roles admin.*
- **1.7-bis (pendiente al cierre del reporte):** no existía pantalla para resolver conflictos de prioridad. El cliente `catalogsApi.makeDecision`/`getConflicts` apuntaba a `/internal/priority/**`, que no existe, y usaba decisiones inexistentes (`KEEP_NEW`/`KEEP_DISPLACED`); no tenía consumidores. La decisión quedó resuelta después: la pantalla permanece como trabajo futuro y la consulta/resolución están disponibles por API; ver `docs/decisiones-funcionales.md`.
- **1.7-ter:** `getCurrentUser()` está duplicado en 5 servicios. Se creó `CurrentUserService`; migrar las copias restantes es limpieza opcional.
- **1.5:** `ability.ts` daba a USUARIO `update`/`delete` sobre `Event` y el dashboard le disparaba consultas que respondían 403. Corregido en 1.5.
- **2.5-bis:** el correo de alta no incluía el código de seguimiento, aunque el reporte daba por hecho que sí. Corregido en 2.5.
- **2.3 (diagnóstico corregido):** los filtros visibles del listado funcionaban en el cliente. Lo engañoso era el cliente HTTP, que mandaba parámetros que el backend ignora, y dos funciones (`getEventStats`, `exportEvents`) que llamaban endpoints inexistentes.
- **Decisión asumida (1.4):** USUARIO puede *leer* catálogos (`GET /api/catalogs/**`) para los filtros del listado.
- **Decisión asumida (4.3):** los rechazos por conflicto de espacio o capacidad técnica no se auditan, porque abortan la operación sin persistir cambios.
- **Decisión asumida (2.5):** el motivo de rechazo de una *solicitud* se comunica al solicitante. El motivo de rechazo de un *evento* sigue siendo interno.

| Fase | ID | Hallazgo | Estado | Commit | Test |
|:-:|---|---|---|---|---|
| 1 | 2.1 | CONVERTIDO mostrado como "Aprobada" | corregido | eaf4a8d | tsc (UI) |
| 1 | 2.2 | Baja de evento usa DELETE inexistente | corregido | 3097d76 | tsc (UI) |
| 1 | 2.7 | Cambio de contraseña propio (DTO + botón) | corregido | 0979086 | ChangePasswordIntegrationTest |
| 1 | 3.4 | Decisión CANCELLED sin efecto → eliminar | corregido | f00f3e5 | PriorityConflictAccessIntegrationTest |
| 1 | 1.6 | `/api/priority/conflicts/pending` sin rol | corregido | 9f0d668 | PriorityConflictAccessIntegrationTest |
| 1 | 5.3 | Varias configs de capacidad activas | corregido | dd0415b | compilación |
| 1 | 6.3 | Motivo de rechazo opcional en backend | corregido | 16c466e | EventRejectionIntegrationTest |
| 1 | 2.10 | Promesa de sugerencias automáticas | corregido | ac157d9 | suite completa |
| 2 | 1.1 | Tracking expone comentarios internos (P0) | corregido | 2b509af | PublicTrackingIntegrationTest |
| 2 | 1.3 | Tracking expone datos internos | corregido | 2b509af, 87127a4 | PublicTrackingIntegrationTest |
| 2 | 1.7 | Decisor de conflicto informado por el cliente | corregido | 43b1093 | PriorityConflictDecisionIntegrationTest |
| 2 | 4.5 | Soft-delete sin auditoría | corregido | 941727b | EventSoftDeleteIntegrationTest |
| 2 | 3.7 | Cambio de buffers/freeLocation no vuelve a revisión | corregido | 8af6b08 | EventLocationAndReviewIntegrationTest |
| 2 | 2.9 | Cambio de espacio a ubicación libre | corregido | 8af6b08 | EventLocationAndReviewIntegrationTest |
| 2 | 3.3 | Estado SOLICITADO huérfano | corregido | d0db212 | suite completa + V13 (verificar en Docker) |
| 2 | 3.2 | requiresTech no se define en la conversión | corregido | 226ca6a | RequestConversionIntegrationTest |
| 2 | 5.1 | expectedVersion/clientMutationId ficticios | corregido | 68f00f2 | suite completa |
| 3 | 2.4 | Bandeja admin sobre endpoint público | corregido | 8ba5f44 | AdminRequestInboxIntegrationTest |
| 3 | 1.2 | Listado público de solicitudes con datos personales (P0) | corregido | 4a992d4 | AdminRequestInboxIntegrationTest |
| 3 | 1.4 | USUARIO con permisos excesivos (P0) | corregido | 2d9a04f | UsuarioPermissionsIntegrationTest |
| 3 | 1.5 | Desalineación CASL vs backend | corregido | e5b4881 | tsc + revisión de matriz |
| 3 | 2.6 | Motivo de rechazo de solicitud mal modelado | corregido | 5b3734d, 3e12d70 | RequestRejectionAndHistoryIntegrationTest |
| 3 | 4.1 | Historial de solicitud sin actor/motivo | corregido | 5b3734d | RequestRejectionAndHistoryIntegrationTest |
| 3 | 4.2 | Sin endpoint admin de historial de solicitud | corregido | 5b3734d, 3e12d70 | RequestRejectionAndHistoryIntegrationTest |
| 3 | 2.5 | Correos prometidos no enviados | corregido | 141f680 | RequestEmailNotificationsIntegrationTest |
| 3 | 2.3 | Filtros del listado sin soporte backend | corregido (diagnóstico corregido) | 8fff37c | tsc |
| 3 | 4.3 | Tipos de auditoría sin uso | corregido | 5f25614 | suite completa |
| 3 | 4.6 | Conflictos de prioridad fuera del historial | corregido | 5f25614 | PriorityConflictDecisionIntegrationTest |
| 3 | 2.8 | Edición de comentarios sin UI | corregido | 4b3ce25 | tsc + lint |
| 4 | 5.2 | Carrera en capacidad técnica | corregido | 4551e5a | TechCapacityConcurrencyIntegrationTest (+ carrera real en MySQL) |
| 4 | 3.8 | Buffers que cruzan medianoche | corregido | 1505f52, f3e1e53 | CrossMidnightAvailabilityIntegrationTest, TechCapacityConcurrencyIntegrationTest |
| 4 | 4.4 | Auditoría incompleta de campos del evento | corregido | b4ba03b | EventFieldAuditIntegrationTest |
| 4 | 5.4 | Indicador de capacidad en frontend ≠ backend | corregido | 655739e | tsc + lint |
| 4 | 6.2 | Reprogramación pendiente poco visible | cubierto (sin cambios) | 5f25614 (auditoría) | badge requiresRebooking ya presente en detalle, listado y dashboard |
| doc | 3.1 | technicalOk siempre obligatoria | documentado | 7933c8a | docs/decisiones-funcionales.md |
| doc | 3.5 | Sin administración de capacidad técnica | documentado | dd0415b, 7933c8a | docs/decisiones-funcionales.md |
| doc | 3.6 | technicalSchedule no afecta capacidad | documentado | 7933c8a | docs/decisiones-funcionales.md |
| doc | 3.9 | Aprobación parcial antes de validar capacidad | documentado | 7933c8a | docs/decisiones-funcionales.md |
| doc | 5.5 | Fallas de correo silenciosas | corregido + documentado | a5d6328, 7933c8a | docs/decisiones-funcionales.md |
| doc | 6.1 | Ubicación libre no se valida como recurso | documentado | 7933c8a | docs/decisiones-funcionales.md |
| test | 5.6 | Cobertura de flujos críticos | corregido | varios | 39 tests de integración (antes 3) |
| final | 5.7 | Verificación E2E en entorno limpio | verificado | d43a58a | Docker limpio: 14 migraciones OK, smoke por rol, correos en Mailpit, carrera de capacidad en MySQL |
