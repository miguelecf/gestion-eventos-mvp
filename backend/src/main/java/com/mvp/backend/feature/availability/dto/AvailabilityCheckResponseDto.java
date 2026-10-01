package com.mvp.backend.feature.availability.dto;

import java.util.List;

public record AvailabilityCheckResponseDto(
        Boolean isAvailable,
        boolean skipped,
        String reason,
        String effectiveFrom,
        String effectiveTo,
        List<ConflictItemDto> conflicts
) {
}