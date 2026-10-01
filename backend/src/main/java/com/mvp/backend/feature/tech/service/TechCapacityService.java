package com.mvp.backend.feature.tech.service;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.events.model.TechSupportMode;
import com.mvp.backend.feature.events.repository.EventRepository;
import com.mvp.backend.feature.tech.dto.TechCapacityResponse;
import com.mvp.backend.feature.tech.dto.TechEventResponse;
import com.mvp.backend.feature.tech.model.TechCapacityConfig;
import com.mvp.backend.feature.tech.repository.TechCapacityConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TechCapacityService {

    private static final List<Status> BLOCKING_STATUSES = List.of(Status.RESERVADO, Status.APROBADO);

    private final TechCapacityConfigRepository configRepository;
    private final EventRepository eventRepository;

    /**
     * Verifica cupo técnico. Bloquea la configuración activa (FOR UPDATE) dentro de la transacción
     * del llamador, de modo que dos operaciones concurrentes no puedan leer el mismo uso y superar
     * la capacidad (hallazgo 5.2). El lock se libera al commit/rollback del llamador.
     */
    @Transactional
    public boolean hasCapacity(LocalDate date,
                               LocalTime from,
                               LocalTime to,
                               int bufferBefore,
                               int bufferAfter,
                               TechSupportMode mode,
                               Long ignoreEventId) {
        if (date == null || from == null || to == null) {
            return true;
        }
        TechCapacityConfig config = lockActiveConfig();
        Map<LocalDateTime, Integer> usage = buildUsage(date, ignoreEventId, config);
        List<LocalDateTime> requiredBlocks = computeBlocks(date, from, to, bufferBefore, bufferAfter, mode, config.getBlockMinutes());
        int capacity = config.getDefaultSlotsPerBlock();
        for (LocalDateTime block : requiredBlocks) {
            int used = usage.getOrDefault(block, 0);
            if (used + 1 > capacity) {
                return false;
            }
        }
        return true;
    }

    public TechCapacityResponse getCapacity(LocalDate date) {
        TechCapacityConfig config = getActiveConfig();
        Map<LocalDateTime, Integer> usage = buildUsage(date, null, config);
        List<TechCapacityResponse.Block> blocks = new ArrayList<>();
        LocalDateTime cursor = date.atStartOfDay();
        LocalDateTime dayEnd = cursor.plusDays(1);
        while (cursor.isBefore(dayEnd)) {
            LocalTime start = cursor.toLocalTime();
            LocalTime end = cursor.plusMinutes(config.getBlockMinutes()).toLocalTime();
            int used = usage.getOrDefault(cursor, 0);
            int available = Math.max(config.getDefaultSlotsPerBlock() - used, 0);
            blocks.add(new TechCapacityResponse.Block(start, end, used, available));
            cursor = cursor.plusMinutes(config.getBlockMinutes());
        }
        return new TechCapacityResponse(date, config.getBlockMinutes(), config.getDefaultSlotsPerBlock(), blocks);
    }

    public List<TechEventResponse> getEvents(LocalDate date) {
        List<Event> events = eventRepository.findTechEventsForDate(date, BLOCKING_STATUSES, null);
        return events.stream()
                .map(event -> new TechEventResponse(
                        event.getId(),
                        event.getName(),
                        event.getSpace() != null ? event.getSpace().getId() : null,
                        event.getScheduleFrom(),
                        event.getScheduleTo(),
                        event.getTechSupportMode() != null ? event.getTechSupportMode() : TechSupportMode.SETUP_ONLY,
                        event.getRequestingArea()
                ))
                .sorted(Comparator.comparing(TechEventResponse::from, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(TechEventResponse::eventId, Comparator.nullsLast(Long::compareTo)))
                .toList();
    }

    /**
     * Uso por bloque (fecha+hora). Incluye eventos del día anterior y siguiente: sus buffers
     * pueden cruzar medianoche y consumir bloques de {@code date} (hallazgo 3.8).
     */
    private Map<LocalDateTime, Integer> buildUsage(LocalDate date, Long ignoreEventId, TechCapacityConfig config) {
        List<Event> events = eventRepository.findTechEventsBetween(date.minusDays(1), date.plusDays(1),
                BLOCKING_STATUSES, ignoreEventId);
        Map<LocalDateTime, Integer> usage = new HashMap<>();
        for (Event event : events) {
            TechSupportMode mode = event.getTechSupportMode() != null ? event.getTechSupportMode() : TechSupportMode.SETUP_ONLY;
            List<LocalDateTime> blocks = computeBlocks(event.getDate(),
                    event.getScheduleFrom(),
                    event.getScheduleTo(),
                    event.getBufferBeforeMin(),
                    event.getBufferAfterMin(),
                    mode,
                    config.getBlockMinutes());
            for (LocalDateTime block : blocks) {
                usage.merge(block, 1, Integer::sum);
            }
        }
        return usage;
    }

    private List<LocalDateTime> computeBlocks(LocalDate date,
                                          LocalTime from,
                                          LocalTime to,
                                          int bufferBefore,
                                          int bufferAfter,
                                          TechSupportMode mode,
                                          int blockMinutes) {
        if (from == null || to == null) {
            return List.of();
        }
        mode = mode != null ? mode : TechSupportMode.SETUP_ONLY;
        Set<LocalDateTime> blocks = new LinkedHashSet<>();
        if (mode == TechSupportMode.ATTENDED) {
            LocalDateTime start = date.atTime(from).minusMinutes(bufferBefore);
            LocalDateTime end = date.atTime(to).plusMinutes(bufferAfter);
            collectBlocks(start, end, blockMinutes, blocks);
        } else {
            if (bufferBefore > 0) {
                LocalDateTime start = date.atTime(from).minusMinutes(bufferBefore);
                LocalDateTime end = date.atTime(from);
                collectBlocks(start, end, blockMinutes, blocks);
            }
            if (bufferAfter > 0) {
                LocalDateTime start = date.atTime(to);
                LocalDateTime end = date.atTime(to).plusMinutes(bufferAfter);
                collectBlocks(start, end, blockMinutes, blocks);
            }
        }
        return new ArrayList<>(blocks);
    }

    /** Bloques de la grilla (alineados a blockMinutes desde las 00:00) que intersectan el rango, sin recortar al día. */
    private void collectBlocks(LocalDateTime rangeStart,
                               LocalDateTime rangeEnd,
                               int blockMinutes,
                               Set<LocalDateTime> accumulator) {
        if (!rangeEnd.isAfter(rangeStart)) {
            return;
        }
        int minuteOfDay = rangeStart.getHour() * 60 + rangeStart.getMinute();
        LocalDateTime cursor = rangeStart.toLocalDate().atStartOfDay()
                .plusMinutes((long) (minuteOfDay / blockMinutes) * blockMinutes);
        while (cursor.isBefore(rangeEnd)) {
            accumulator.add(cursor);
            cursor = cursor.plusMinutes(blockMinutes);
        }
    }

    private TechCapacityConfig lockActiveConfig() {
        return configRepository.findActiveForUpdate(PageRequest.of(0, 1)).stream()
                .findFirst()
                .orElseGet(this::getActiveConfig);
    }

    private TechCapacityConfig getActiveConfig() {
        return configRepository.findFirstByActiveTrueOrderByIdDesc()
                .orElseGet(() -> TechCapacityConfig.builder()
                        .blockMinutes(30)
                        .defaultSlotsPerBlock(10)
                        .active(true)
                        .timezone("UTC")
                        .build());
    }
}
