SET NAMES utf8mb4;

-- REV-07 (TECH-01): control optimista. Una escritura sobre una versión vieja del evento o de la
-- solicitud se rechaza (409) en lugar de pisar la más nueva.
ALTER TABLE events
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE event_requests
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
