package com.mvp.backend.feature.events.dto;

import com.mvp.backend.feature.events.model.Status;
import jakarta.validation.constraints.NotNull;

public record ChangeStatusRequest(
        @NotNull(message = "to is required")
        Status to,
        String reason,
        String note,
        Boolean ceremonialOk,
        Boolean technicalOk
) { }
