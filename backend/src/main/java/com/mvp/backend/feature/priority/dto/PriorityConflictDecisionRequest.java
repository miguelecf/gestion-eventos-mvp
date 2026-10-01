package com.mvp.backend.feature.priority.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.mvp.backend.feature.priority.model.PriorityConflictDecision;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.time.LocalTime;

public record PriorityConflictDecisionRequest(
        @NotBlank
        String conflictId,
        @NotNull
        PriorityConflictDecision decision,
        Target target,
        String reason
) {
    public record Target(
            @NotNull
            @JsonFormat(pattern = "yyyy-MM-dd")
            LocalDate date,
            @NotNull
            @JsonFormat(pattern = "HH:mm")
            LocalTime from,
            @NotNull
            @JsonFormat(pattern = "HH:mm")
            LocalTime to,
            @NotNull
            @Positive
            Long spaceId
    ) {}
}