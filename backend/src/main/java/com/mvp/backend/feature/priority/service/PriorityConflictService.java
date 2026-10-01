package com.mvp.backend.feature.priority.service;

import com.mvp.backend.feature.availability.exception.AvailabilityConflictException;
import com.mvp.backend.feature.availability.model.AvailabilityParams;
import com.mvp.backend.feature.availability.service.AvailabilityService;
import com.mvp.backend.feature.catalogs.model.Space;
import com.mvp.backend.feature.catalogs.repository.SpaceRepository;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.TechSupportMode;
import com.mvp.backend.feature.events.repository.EventRepository;
import com.mvp.backend.feature.history.service.AuditService;
import com.mvp.backend.feature.priority.dto.PriorityConflictDecisionRequest;
import com.mvp.backend.feature.priority.event.PriorityConflictCreatedEvent;
import com.mvp.backend.feature.priority.model.PriorityConflict;
import com.mvp.backend.feature.priority.model.PriorityConflictDecision;
import com.mvp.backend.feature.priority.model.PriorityConflictStatus;
import com.mvp.backend.feature.priority.repository.PriorityConflictRepository;
import com.mvp.backend.feature.tech.exception.TechCapacityExceededException;
import com.mvp.backend.feature.tech.service.TechCapacityService;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.auth.security.CurrentUserService;
import com.mvp.backend.shared.DomainValidationException;
import com.mvp.backend.feature.notifications.event.PriorityConflictEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PriorityConflictService {

    private static final DateTimeFormatter CODE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final PriorityConflictRepository repository;
    private final EventRepository eventRepository;
    private final SpaceRepository spaceRepository;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;
    private final AvailabilityService availabilityService;
    private final TechCapacityService techCapacityService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public List<PriorityConflict> registerConflicts(Event highEvent, List<Event> displacedEvents, User initiatedBy) {
        if (displacedEvents == null || displacedEvents.isEmpty()) {
            return repository.findByHighEventIdAndStatus(highEvent.getId(), PriorityConflictStatus.OPEN);
        }
        List<PriorityConflict> openConflicts = new ArrayList<>(
                repository.findByHighEventIdAndStatus(highEvent.getId(), PriorityConflictStatus.OPEN));
        Set<Long> alreadyRegistered = new HashSet<>();
        Map<LocalDate, Long> sequenceByDate = new HashMap<>();
        for (PriorityConflict existing : openConflicts) {
            if (existing.getDisplacedEvent() != null) {
                alreadyRegistered.add(existing.getDisplacedEvent().getId());
            }
            if (existing.getDate() != null && !sequenceByDate.containsKey(existing.getDate())) {
                sequenceByDate.put(existing.getDate(), repository.countByDate(existing.getDate()));
            }
        }

        for (Event displaced : displacedEvents) {
            if (displaced.getId() != null && alreadyRegistered.contains(displaced.getId())) {
                displaced.setRequiresRebooking(true);
                eventRepository.save(displaced);
                continue;
            }

            displaced.setRequiresRebooking(true);
            eventRepository.save(displaced);

            LocalDate conflictDate = highEvent.getDate() != null ? highEvent.getDate()
                    : (displaced.getDate() != null ? displaced.getDate() : LocalDate.now());
            long sequence = sequenceByDate.compute(conflictDate, (date, value) -> {
                long base = value != null ? value : repository.countByDate(date);
                return base + 1;
            });
            String code = buildCode(conflictDate, sequence);

            PriorityConflict conflict = PriorityConflict.builder()
                    .conflictCode(code)
                    .highEvent(highEvent)
                    .displacedEvent(displaced)
                    .spaceId(resolveSpaceId(highEvent, displaced))
                    .date(conflictDate)
                    .fromTime(resolveFrom(highEvent, displaced))
                    .toTime(resolveTo(highEvent, displaced))
                    .status(PriorityConflictStatus.OPEN)
                    .createdBy(initiatedBy)
                    .build();

            PriorityConflict saved = repository.save(conflict);
            openConflicts.add(saved);
            if (displaced.getId() != null) {
                alreadyRegistered.add(displaced.getId());
            }
            eventPublisher.publishEvent(new PriorityConflictCreatedEvent(saved));
            eventPublisher.publishEvent(new PriorityConflictEvent(
                    saved.getId(),
                    displaced.getId(),
                    highEvent != null ? highEvent.getId() : null));
        }
        return openConflicts;
    }

    @Transactional(readOnly = true)
    public List<PriorityConflict> getOpenConflicts(Long highEventId) {
        return repository.findByHighEventIdAndStatus(highEventId, PriorityConflictStatus.OPEN);
    }

    @Transactional(readOnly = true)
    public Page<PriorityConflict> getAllOpenConflicts(Pageable pageable) {
        return repository.findByStatus(PriorityConflictStatus.OPEN, pageable);
    }

    @Transactional
    public PriorityConflict applyDecision(PriorityConflictDecisionRequest request) {
        PriorityConflict conflict = repository.findByConflictCode(request.conflictId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conflict not found"));

        if (conflict.getStatus() == PriorityConflictStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "CONFLICT_ALREADY_CLOSED");
        }

        // El decisor es siempre el usuario autenticado (hallazgo 1.7); nunca se acepta desde el cliente.
        User decider = currentUserService.get();

        Event displaced = conflict.getDisplacedEvent();
        if (displaced == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Displaced event not found");
        }

        if (request.decision() == PriorityConflictDecision.REBOOK_OTHER) {
            applyRebooking(request, displaced, decider);
        } else {
            displaced.setRequiresRebooking(false);
            displaced.setLastModifiedBy(decider);
            eventRepository.save(displaced);
        }

        conflict.setStatus(PriorityConflictStatus.CLOSED);
        conflict.setDecision(request.decision());
        conflict.setDecisionBy(decider);
        conflict.setClosedAt(Instant.now());
        conflict.setReason(trimToNull(request.reason()));

        repository.save(conflict);

        return conflict;
    }

    private void applyRebooking(PriorityConflictDecisionRequest request, Event displaced, User decider) {
        PriorityConflictDecisionRequest.Target target = request.target();
        if (target == null) {
            throw new DomainValidationException("Target is required for REBOOK_OTHER decisions");
        }
        Space targetSpace = spaceRepository.findById(target.spaceId())
                .filter(Space::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Space not found"));

        if (target.from() != null && target.to() != null && !target.to().isAfter(target.from())) {
            throw new DomainValidationException("target.to must be after target.from");
        }

        AvailabilityParams params = AvailabilityParams.builder()
                .date(target.date())
                .spaceId(targetSpace.getId())
                .scheduleFrom(target.from())
                .scheduleTo(target.to())
                .bufferBeforeMin(displaced.getBufferBeforeMin())
                .bufferAfterMin(displaced.getBufferAfterMin())
                .ignoreEventId(displaced.getId())
                .build();

        var availability = availabilityService.checkSpaceAvailability(params);
        if (Boolean.FALSE.equals(availability.isAvailable())) {
            throw AvailabilityConflictException.internalConflict(availability);
        }

        if (displaced.isRequiresTech()) {
            TechSupportMode mode = displaced.getTechSupportMode() != null ? displaced.getTechSupportMode()
                    : TechSupportMode.SETUP_ONLY;
            if (!techCapacityService.hasCapacity(target.date(), target.from(), target.to(),
                    displaced.getBufferBeforeMin(), displaced.getBufferAfterMin(), mode, displaced.getId())) {
                throw new TechCapacityExceededException(
                        "No hay capacidad técnica disponible para el rango solicitado.");
            }
        }

        displaced.setDate(target.date());
        displaced.setScheduleFrom(target.from());
        displaced.setScheduleTo(target.to());
        displaced.setSpace(targetSpace);
        displaced.setFreeLocation(null);
        displaced.setLastModifiedBy(decider);
        displaced.setRequiresRebooking(false);

        eventRepository.save(displaced);

        auditService.recordScheduleChange(displaced, decider, displaced.getDate(), displaced.getScheduleFrom(),
                displaced.getScheduleTo());
    }

    private String buildCode(LocalDate date, long sequence) {
        return "PRIO-" + CODE_FORMATTER.format(date) + "-" + String.format("%05d", sequence);
    }

    private Long resolveSpaceId(Event highEvent, Event displacedEvent) {
        if (highEvent.getSpace() != null) {
            return highEvent.getSpace().getId();
        }
        if (displacedEvent.getSpace() != null) {
            return displacedEvent.getSpace().getId();
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Space information is required to register conflict");
    }

    private java.time.LocalTime resolveFrom(Event highEvent, Event displacedEvent) {
        return Objects.requireNonNullElse(highEvent.getScheduleFrom(), displacedEvent.getScheduleFrom());
    }

    private java.time.LocalTime resolveTo(Event highEvent, Event displacedEvent) {
        return Objects.requireNonNullElse(highEvent.getScheduleTo(), displacedEvent.getScheduleTo());
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
