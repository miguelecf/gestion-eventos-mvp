-- Hallazgo 3.3: el estado de Evento SOLICITADO no lo producía ningún flujo y se eliminó del enum.
-- Por seguridad, cualquier evento que haya quedado con ese valor pasa a EN_REVISION
-- (estado en el que nacen las altas manuales y las conversiones de solicitudes).
UPDATE events SET status = 'EN_REVISION' WHERE status = 'SOLICITADO';
