package com.mvp.backend.feature.availability.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.mvp.backend.feature.availability.model.AvailabilityParams;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;
import java.time.LocalTime;

public record AvailabilityCheckRequestDto(
        @NotNull @JsonFormat(pattern = "yyyy-MM-dd") LocalDate date,
        Long spaceId,
        String freeLocation,
        @NotNull @JsonFormat(pattern = "HH:mm") LocalTime scheduleFrom,
        @NotNull @JsonFormat(pattern = "HH:mm") LocalTime scheduleTo,
        // Mismo tope que el alta, la edición y la solicitud (REV-15).
        @PositiveOrZero @Max(240) Integer bufferBeforeMin,
        @PositiveOrZero @Max(240) Integer bufferAfterMin,
        Long ignoreEventId
) {

    @AssertTrue(message = "scheduleFrom must be before scheduleTo")
    public boolean isScheduleRangeValid() {
        if (scheduleFrom == null || scheduleTo == null) {
            return true;
        }
        return scheduleFrom.isBefore(scheduleTo);
    }

    @AssertTrue(message = "Either spaceId or freeLocation must be provided, but not both")
    public boolean isLocationValid() {
        boolean hasSpace = spaceId != null;
        boolean hasFreeLocation = freeLocation != null && !freeLocation.isBlank();
        return hasSpace ^ hasFreeLocation;
    }

    public AvailabilityParams toParams() {
        String trimmedFreeLocation = freeLocation == null ? null : freeLocation.trim();
        if (trimmedFreeLocation != null && trimmedFreeLocation.isEmpty()) {
            trimmedFreeLocation = null;
        }
        return AvailabilityParams.builder()
                .date(date)
                .spaceId(spaceId)
                .freeLocation(trimmedFreeLocation)
                .scheduleFrom(scheduleFrom)
                .scheduleTo(scheduleTo)
                .bufferBeforeMin(bufferBeforeMin)
                .bufferAfterMin(bufferAfterMin)
                .ignoreEventId(ignoreEventId)
                .build();
    }
}