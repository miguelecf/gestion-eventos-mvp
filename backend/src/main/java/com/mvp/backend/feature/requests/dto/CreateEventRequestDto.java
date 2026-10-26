package com.mvp.backend.feature.requests.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.mvp.backend.feature.requests.validation.TimeRange;
import com.mvp.backend.feature.requests.validation.XorLocation;
import com.mvp.backend.shared.AudienceType;
import jakarta.validation.constraints.*;
import com.mvp.backend.shared.validation.HasLocationChoice;
import com.mvp.backend.shared.validation.HasScheduleRange;

import java.time.LocalDate;
import java.time.LocalTime;

@XorLocation
@TimeRange
public record CreateEventRequestDto(
        @NotNull(message = "date is required")
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate date,

        @JsonFormat(pattern = "HH:mm")
        LocalTime technicalSchedule,

        @NotNull(message = "scheduleFrom is required")
        @JsonFormat(pattern = "HH:mm")
        LocalTime scheduleFrom,

        @NotNull(message = "scheduleTo is required")
        @JsonFormat(pattern = "HH:mm")
        LocalTime scheduleTo,

        @JsonProperty("space_id")
        @Positive(message = "spaceId must be positive")
        Long spaceId,

        @JsonProperty("free_location")
        @Size(min = 1, max = 200, message = "freeLocation length must be between 1 and 200 characters")
        String freeLocation,

        @NotBlank(message = "name is required")
        @Size(max = 200, message = "name must be at most 200 characters")
        String name,

        @JsonProperty("requesting_department_id")
        @Positive(message = "requestingDepartmentId must be positive")
        Long requestingDepartmentId,

        @Size(max = 255, message = "requirements must be at most 255 characters")
        String requirements,

        String coverage,

        String observations,

        @JsonProperty("audienceType")
        @NotNull(message = "audienceType is required")
        AudienceType audienceType,

        @NotBlank(message = "contactName is required")
        @Size(max = 120, message = "contactName must be at most 120 characters")
        String contactName,

        @NotBlank(message = "contactEmail is required")
        @Email(message = "contactEmail must be a valid email")
        @Size(max = 120, message = "contactEmail must be at most 120 characters")
        String contactEmail,

        @NotBlank(message = "contactPhone is required")
        @Size(max = 30, message = "contactPhone must be at most 30 characters")
        @Pattern(regexp = "^[+\\d\\s-]+$", message = "contactPhone must contain only digits, spaces, plus signs or hyphens")
        String contactPhone,

        @Min(value = 0, message = "bufferBeforeMin must be at least 0")
        @Max(value = 240, message = "bufferBeforeMin must be at most 240")
        Integer bufferBeforeMin,

        @Min(value = 0, message = "bufferAfterMin must be at least 0")
        @Max(value = 240, message = "bufferAfterMin must be at most 240")
        Integer bufferAfterMin
) implements HasScheduleRange, HasLocationChoice {
}