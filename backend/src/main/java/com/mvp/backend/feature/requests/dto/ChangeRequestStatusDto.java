package com.mvp.backend.feature.requests.dto;

import com.mvp.backend.feature.requests.model.RequestStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ChangeRequestStatusDto(
        @NotNull(message = "newStatus is required") RequestStatus newStatus,
        @Size(max = 500, message = "reason must be at most 500 characters") String reason) {
}
