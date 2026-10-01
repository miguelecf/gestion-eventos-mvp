package com.mvp.backend.feature.requests.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.requests.model.RequestStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Contrato PÚBLICO de seguimiento (GET /public/track/{uuid}).
 * Mínimo indispensable para el solicitante: sin IDs internos, flags administrativos,
 * buffers, horario técnico ni detalles de auditoría (comentarios internos, etc.).
 */
public record TrackingResponse(
        String trackingUuid,
        String name,
        /** Motivo informado al rechazar la solicitud (sólo si está RECHAZADA). */
        String rejectionReason,
        RequestData request,
        EventData event,
        ScheduleData schedule,
        LocationData location,
        List<TimelineEntry> timeline
) {
    public record RequestData(RequestStatus status, Instant submittedAt) { }

    /** Estado del evento creado al convertir la solicitud (null si aún no se convirtió). */
    public record EventData(Status status) { }

    public record ScheduleData(
            @JsonFormat(pattern = "yyyy-MM-dd") LocalDate date,
            @JsonFormat(pattern = "HH:mm") LocalTime from,
            @JsonFormat(pattern = "HH:mm") LocalTime to) { }

    public record LocationData(LocationType type, String spaceName, String freeLocation) {
        public enum LocationType { SPACE, FREE }
    }

    /** Hitos visibles para el solicitante: cambios de estado y de agenda, sin detalles internos. */
    public record TimelineEntry(Instant at, Scope scope, Type type, String from, String to) {
        public enum Scope { REQUEST, EVENT }
        public enum Type { STATUS, SCHEDULE_CHANGE }
    }
}
