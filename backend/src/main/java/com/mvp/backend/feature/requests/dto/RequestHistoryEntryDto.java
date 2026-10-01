package com.mvp.backend.feature.requests.dto;

import com.mvp.backend.feature.history.model.HistoryType;

import java.time.Instant;

/** Entrada del historial de una solicitud para usuarios internos (GET /admin/event-requests/{id}/history). */
public record RequestHistoryEntryDto(
        Long id,
        Instant at,
        HistoryType type,
        String fromValue,
        String toValue,
        String reason,
        ActorRef actor
) {
    /** null cuando la acción la originó el solicitante público (alta). */
    public record ActorRef(Long id, String username, String name, String lastName) { }
}
