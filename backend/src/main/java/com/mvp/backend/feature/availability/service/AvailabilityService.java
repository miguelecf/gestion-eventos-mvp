package com.mvp.backend.feature.availability.service;

import com.mvp.backend.feature.availability.model.*;
import com.mvp.backend.feature.catalogs.model.Space;
import com.mvp.backend.feature.catalogs.repository.SpaceRepository;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.events.repository.EventRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AvailabilityService {
    private final EventRepository eventRepository;
    private final SpaceRepository spaceRepository;

    public AvailabilityResult checkSpaceAvailability(AvailabilityParams params) {
        if (params.spaceId() == null) {
            return AvailabilityResult.builder()
                    .isAvailable(null)
                    .skipped(true)
                    .reason("freeLocation: no se valida por recurso")
                    .conflicts(List.of())
                    .build();
        }

        // Un espacio dado de baja no se ofrece para asignaciones nuevas (RF-13), pero un evento que ya
        // lo tenía (ignoreEventId) sigue validándose: si no, quedaba sin poder editarse ni reservarse.
        Space space = spaceRepository.findById(params.spaceId())
                .filter(s -> s.isActive() || params.ignoreEventId() != null)
                .orElseThrow(() -> new EntityNotFoundException("Space not found"));

        int bufferBefore = resolveBuffer(params.bufferBeforeMin(), space.getDefaultBufferBeforeMin());
        int bufferAfter = resolveBuffer(params.bufferAfterMin(), space.getDefaultBufferAfterMin());

        TimeWindow candidateWindow = TimeWindow.of(params.date(), params.scheduleFrom(), params.scheduleTo())
                .withBuffers(bufferBefore, bufferAfter);

        List<Status> blockingStatuses  = List.of(Status.RESERVADO, Status.APROBADO);


        // Se incluyen el día anterior y el siguiente: sus buffers pueden cruzar medianoche (hallazgo 3.8).
        List<Event> potentialConflicts = eventRepository.findConflictingEventsBetween(
                params.date().minusDays(1),
                params.date().plusDays(1),
                params.spaceId(),
                blockingStatuses,
                params.ignoreEventId()
        );

        List<ConflictItem> conflicts = new ArrayList<>();
        for (Event event : potentialConflicts) {
            if (event.getScheduleFrom() == null || event.getScheduleTo() == null) {
                continue;
            }
            TimeWindow existingWindow = TimeWindow.of(event.getDate(), event.getScheduleFrom(), event.getScheduleTo())
                    .withBuffers(event.getBufferBeforeMin(), event.getBufferAfterMin());
            if (candidateWindow.overlaps(existingWindow)) {
                conflicts.add(ConflictItem.builder()
                        .eventId(event.getId())
                        .status(event.getStatus())
                        .title(event.getName())
                        .spaceId(event.getSpace() != null ? event.getSpace().getId() : null)
                        .date(event.getDate())
                        .from(existingWindow.formattedStart())
                        .to(existingWindow.formattedEnd())
                        .internal(event.isInternal())
                        .bufferBeforeMin(event.getBufferBeforeMin())
                        .bufferAfterMin(event.getBufferAfterMin())
                        .build());
            }
        }

        return AvailabilityResult.builder()
                .isAvailable(conflicts.isEmpty())
                .skipped(false)
                .effectiveFrom(candidateWindow.formattedStart())
                .effectiveTo(candidateWindow.formattedEnd())
                .conflicts(conflicts)
                .build();
    }

    public SpaceOccupancy getSpaceOccupancy(Long spaceId, LocalDate date) {
        spaceRepository.findById(spaceId)
                .filter(Space::isActive)
                .orElseThrow(() -> new EntityNotFoundException("Space not found"));

        List<Status> blockingStatuses  = List.of(Status.RESERVADO, Status.APROBADO);

        // Incluye eventos de días adyacentes cuyos buffers caen en este día (hallazgo 3.8).
        List<SpaceOccupancy.SpaceOccupancyBlock> blocks = eventRepository
                .findConflictingEventsBetween(date.minusDays(1), date.plusDays(1), spaceId, blockingStatuses, null)
                .stream()
                .filter(event -> event.getScheduleFrom() != null && event.getScheduleTo() != null)
                .map(event -> {
                    TimeWindow window = TimeWindow.of(event.getDate(), event.getScheduleFrom(), event.getScheduleTo())
                            .withBuffers(event.getBufferBeforeMin(), event.getBufferAfterMin())
                            .clampToDay(date);
                    if (window == null) {
                        return null;
                    }
                    return SpaceOccupancy.SpaceOccupancyBlock.builder()
                            .from(window.formattedStart())
                            .to(window.formattedEnd())
                            .status(event.isInternal() ? null : event.getStatus())
                            .build();
                })
                .filter(java.util.Objects::nonNull)
                .sorted(Comparator.comparing(SpaceOccupancy.SpaceOccupancyBlock::from))
                .toList();

        return SpaceOccupancy.builder()
                .spaceId(spaceId)
                .date(date)
                .blocks(blocks)
                .build();
    }

    private int resolveBuffer(Integer requestBuffer, Integer defaultBuffer) {
        if (requestBuffer != null) {
            return requestBuffer;
        }
        return defaultBuffer != null ? defaultBuffer : 0;
    }
}
