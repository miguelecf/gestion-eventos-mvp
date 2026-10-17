package com.mvp.backend.feature.events.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.mvp.backend.shared.Priority;
import com.mvp.backend.feature.events.model.Status;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Contrato PÚBLICO del calendario (GET /public/events).
 * Sólo lo que el calendario muestra: sin contacto del solicitante, usuarios, observaciones,
 * flags de gestión, buffers ni vínculo con la solicitud de origen (SEC-02).
 */
public record PublicEventDto(
        Long id,
        String name,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate date,
        @JsonFormat(pattern = "HH:mm") LocalTime scheduleFrom,
        @JsonFormat(pattern = "HH:mm") LocalTime scheduleTo,
        Status status,
        Priority priority,
        String spaceName,
        String freeLocation,
        String departmentName
) { }
