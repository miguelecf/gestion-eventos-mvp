SET NAMES utf8mb4;

-- Hallazgos 2.6 / 4.1: el historial de solicitudes registra quién tomó cada decisión y por qué.
ALTER TABLE event_request_history
    ADD COLUMN actor_user_id BIGINT NULL AFTER request_id,
    ADD COLUMN reason VARCHAR(500) NULL AFTER details;

ALTER TABLE event_request_history
    ADD CONSTRAINT fk_event_request_history_actor FOREIGN KEY (actor_user_id) REFERENCES users(id);
