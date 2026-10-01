package com.mvp.backend.feature.availability.service;

import com.mvp.backend.feature.availability.dto.*;
import com.mvp.backend.feature.availability.model.AvailabilityResult;
import com.mvp.backend.feature.availability.model.ConflictItem;
import com.mvp.backend.feature.availability.model.SpaceOccupancy;
import com.mvp.backend.feature.availability.model.SpaceOccupancy.SpaceOccupancyBlock;
import com.mvp.backend.feature.availability.dto.SpaceOccupancyResponseDto.SpaceOccupancyBlockDto;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AvailabilityMapper {

    public AvailabilityCheckResponseDto toInternalResponse(AvailabilityResult result) {
        List<ConflictItemDto> conflicts = result.conflicts().stream()
                .map(this::toInternalConflict)
                .toList();
        return new AvailabilityCheckResponseDto(
                result.isAvailable(),
                result.skipped(),
                result.reason(),
                result.effectiveFrom(),
                result.effectiveTo(),
                conflicts
        );
    }

    public SpaceOccupancyResponseDto toOccupancyResponse(SpaceOccupancy occupancy) {
        List<SpaceOccupancyBlockDto> blocks = occupancy.blocks().stream()
                .map(this::toBlockDto)
                .toList();
        return new SpaceOccupancyResponseDto(
                occupancy.spaceId(),
                occupancy.date(),
                blocks
        );
    }

    public PublicAvailabilityCheckResponseDto toPublicResponse(AvailabilityResult result) {
        List<PublicConflictItemDto> conflicts = result.conflicts().stream()
                .map(this::toPublicConflict)
                .toList();
        return new PublicAvailabilityCheckResponseDto(
                result.isAvailable(),
                result.skipped(),
                result.reason(),
                result.effectiveFrom(),
                result.effectiveTo(),
                conflicts
        );
    }

    private PublicConflictItemDto toPublicConflict(ConflictItem conflict) {
        return new PublicConflictItemDto(
                conflict.internal() ? null : conflict.status(),
                conflict.from(),
                conflict.to()
        );
    }

    private ConflictItemDto toInternalConflict(ConflictItem conflict) {
        return new ConflictItemDto(
                conflict.eventId(),
                conflict.status(),
                conflict.title(),
                conflict.spaceId(),
                conflict.date(),
                conflict.from(),
                conflict.to(),
                conflict.internal(),
                conflict.bufferBeforeMin(),
                conflict.bufferAfterMin()
        );
    }

    private SpaceOccupancyBlockDto toBlockDto(SpaceOccupancyBlock block) {
        return new SpaceOccupancyBlockDto(
                block.from(),
                block.to(),
                block.status()
        );
    }
}
