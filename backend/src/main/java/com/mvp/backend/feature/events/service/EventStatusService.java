package com.mvp.backend.feature.events.service;

import com.mvp.backend.feature.availability.exception.AvailabilityConflictException;
import com.mvp.backend.feature.availability.model.AvailabilityParams;
import com.mvp.backend.feature.availability.model.AvailabilityResult;
import com.mvp.backend.feature.availability.service.AvailabilityService;
import com.mvp.backend.feature.events.dto.ChangeStatusRequest;
import com.mvp.backend.feature.events.dto.StatusChangeResponse;
import com.mvp.backend.feature.events.dto.StatusOptionsResponse;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.events.repository.EventRepository;
import com.mvp.backend.feature.history.service.AuditService;
import com.mvp.backend.feature.priority.PriorityPolicy;
import com.mvp.backend.feature.priority.service.PriorityConflictService;
import com.mvp.backend.feature.tech.exception.TechCapacityExceededException;
import com.mvp.backend.feature.tech.service.TechCapacityService;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.users.service.UserService;
import com.mvp.backend.feature.notifications.event.EventStatusChangedEvent;
import com.mvp.backend.feature.availability.model.ConflictItem;
import com.mvp.backend.feature.events.model.TechSupportMode;
import com.mvp.backend.shared.DomainValidationException;
import com.mvp.backend.shared.Priority;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional
public class EventStatusService {

    private static final Map<Status, List<Status>> ALLOWED_TRANSITIONS = buildTransitions();

    private final EventRepository eventRepository;
    private final AvailabilityService availabilityService;
    private final TechCapacityService techCapacityService;
    private final PriorityPolicy priorityPolicy;
    private final PriorityConflictService priorityConflictService;
    private final UserService userService;
    private final AuditService auditService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public StatusOptionsResponse getStatusOptions(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));
        return new StatusOptionsResponse(eventId, event.getStatus(), getAllowedTransitions(event.getStatus()));
    }

    public StatusChangeResponse changeStatus(Long eventId, ChangeStatusRequest request) {
        User actor = getCurrentUser();
        ensureOperativeRole(actor);

        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));

        if (!event.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EVENT_INACTIVE");
        }

        Status target = request.to();
        List<Status> allowed = getAllowedTransitions(event.getStatus());
        if (!allowed.contains(target)) {
            throw new DomainValidationException("Transition from " + event.getStatus() + " to " + target + " is not allowed");
        }

        return switch (target) {
            case APROBADO -> handleApproval(event, actor, request);
            case RESERVADO -> handleReservation(event, actor, request);
            case EN_REVISION -> handleReversion(event, actor, request);
            case RECHAZADO -> handleRejection(event, actor, request);
            case SOLICITADO -> throw new DomainValidationException("Cannot transition back to SOLICITADO");
        };
    }

    private StatusChangeResponse handleReservation(Event event, User actor, ChangeStatusRequest request) {
        Status previousStatus = event.getStatus();
        List<Event> displacedEvents = ensureAvailability(event);
        ensureTechCapacity(event);

        event.setStatus(Status.RESERVADO);
        event.setLastModifiedBy(actor);

        Event saved = eventRepository.save(event);

        auditService.recordStatusChange(saved, actor, previousStatus, saved.getStatus(), request.reason(), request.note());
        publishStatusChanged(saved, previousStatus, actor);

        if (!displacedEvents.isEmpty()) {
            priorityConflictService.registerConflicts(saved, displacedEvents, actor);
        }

        return StatusChangeResponse.success(saved.getId(), saved.getStatus());
    }

    private StatusChangeResponse handleReversion(Event event, User actor, ChangeStatusRequest request) {
        Status previousStatus = event.getStatus();
        boolean wasBlocking = isBlockingStatus(previousStatus);

        boolean prevCer = event.isCeremonialOk();
        boolean prevTech = event.isTechnicalOk();

        if (request.ceremonialOk() != null && request.ceremonialOk() != event.isCeremonialOk()) {
            if (!canModifyCeremonial(actor)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CEREMONIAL_ONLY");
            }
            if (Boolean.TRUE.equals(request.ceremonialOk())) {
                throw new DomainValidationException("Ceremonial OK can only be lowered in this transition");
            }
            event.setCeremonialOk(false);
        }

        if (request.technicalOk() != null && request.technicalOk() != event.isTechnicalOk()) {
            if (!canModifyTechnical(actor)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "TECHNICAL_ONLY");
            }
            if (Boolean.TRUE.equals(request.technicalOk())) {
                throw new DomainValidationException("Technical OK can only be lowered in this transition");
            }
            event.setTechnicalOk(false);
        }

        event.setStatus(Status.EN_REVISION);
        event.setLastModifiedBy(actor);

        Event saved = eventRepository.save(event);

        if (wasBlocking) {
            auditService.recordReprogram(saved, actor, saved.getDate(), saved.getScheduleFrom(), saved.getScheduleTo(), request.reason(), request.note());
        }

        auditService.recordStatusChange(saved, actor, previousStatus, saved.getStatus(), request.reason(), request.note());
        auditOkChanges(saved, actor, prevCer, saved.isCeremonialOk(), prevTech, saved.isTechnicalOk(), request.reason(), request.note());
        publishStatusChanged(saved, previousStatus, actor);

        return StatusChangeResponse.success(saved.getId(), saved.getStatus());
    }

    private StatusChangeResponse handleRejection(Event event, User actor, ChangeStatusRequest request) {
        if (request.reason() == null || request.reason().isBlank()) {
            throw new DomainValidationException("Debe indicar el motivo del rechazo");
        }
        Status previousStatus = event.getStatus();
        event.setStatus(Status.RECHAZADO);
        event.setLastModifiedBy(actor);

        Event saved = eventRepository.save(event);
        auditService.recordStatusChange(saved, actor, previousStatus, saved.getStatus(), request.reason(), request.note());
        publishStatusChanged(saved, previousStatus, actor);

        return StatusChangeResponse.success(saved.getId(), saved.getStatus());
    }

    private StatusChangeResponse handleApproval(Event event, User actor, ChangeStatusRequest request) {
        if (!canApprove(actor)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ROLE_NOT_ALLOWED");
        }

        Status previousStatus = event.getStatus();
        boolean prevCer = event.isCeremonialOk();
        boolean prevTech = event.isTechnicalOk();

        if (isAdminFull(actor)) {
            event.setCeremonialOk(true);
            event.setTechnicalOk(true);
        } else {
            if (canModifyCeremonial(actor)) {
                event.setCeremonialOk(true);
            }
            if (canModifyTechnical(actor)) {
                event.setTechnicalOk(true);
            }
        }

        List<String> missing = new ArrayList<>();
        if (!event.isCeremonialOk()) {
            missing.add("ceremonial_ok");
        }
        if (!event.isTechnicalOk()) {
            missing.add("technical_ok");
        }

        event.setLastModifiedBy(actor);

        if (!missing.isEmpty()) {
            Event saved = eventRepository.save(event);
            auditOkChanges(saved, actor, prevCer, saved.isCeremonialOk(), prevTech, saved.isTechnicalOk(), request.reason(), request.note());
            return StatusChangeResponse.pending(saved.getId(), saved.getStatus(), missing);
        }

        List<Event> displacedEvents = ensureAvailability(event);
        ensureTechCapacity(event);

        event.setStatus(Status.APROBADO);

        Event saved = eventRepository.save(event);

        auditService.recordStatusChange(saved, actor, previousStatus, saved.getStatus(), request.reason(), request.note());
        auditOkChanges(saved, actor, prevCer, saved.isCeremonialOk(), prevTech, saved.isTechnicalOk(), request.reason(), request.note());
        publishStatusChanged(saved, previousStatus, actor);

        if (!displacedEvents.isEmpty()) {
            priorityConflictService.registerConflicts(saved, displacedEvents, actor);
        }

        return StatusChangeResponse.success(saved.getId(), saved.getStatus());
    }

    private List<Event> ensureAvailability(Event event) {
        AvailabilityParams params = AvailabilityParams.builder()
                .date(event.getDate())
                .spaceId(event.getSpace() != null ? event.getSpace().getId() : null)
                .freeLocation(event.getSpace() == null ? event.getFreeLocation() : null)
                .scheduleFrom(event.getScheduleFrom())
                .scheduleTo(event.getScheduleTo())
                .bufferBeforeMin(event.getBufferBeforeMin())
                .bufferAfterMin(event.getBufferAfterMin())
                .ignoreEventId(event.getId())
                .build();

        AvailabilityResult availabilityResult = availabilityService.checkSpaceAvailability(params);
        if (Boolean.FALSE.equals(availabilityResult.isAvailable())) {
            if (event.getSpace() == null || event.getPriority() != Priority.HIGH) {
                throw AvailabilityConflictException.internalConflict(availabilityResult);
            }
            return resolvePriorityConflicts(availabilityResult, event.getPriority(), event.getId());
        }
        return List.of();
    }

    private void ensureTechCapacity(Event event) {
        if (!event.isRequiresTech()) {
            return;
        }
        TechSupportMode mode = event.getTechSupportMode() != null ? event.getTechSupportMode() : TechSupportMode.SETUP_ONLY;
        boolean hasCapacity = techCapacityService.hasCapacity(
                event.getDate(),
                event.getScheduleFrom(),
                event.getScheduleTo(),
                event.getBufferBeforeMin(),
                event.getBufferAfterMin(),
                mode,
                event.getId()
        );
        if (!hasCapacity) {
            throw new TechCapacityExceededException("No hay capacidad técnica disponible para el rango solicitado.");
        }
    }

    private List<Event> resolvePriorityConflicts(AvailabilityResult availabilityResult,
                                                 Priority desiredPriority,
                                                 Long ignoreEventId) {
        if (availabilityResult == null || availabilityResult.conflicts() == null) {
            return List.of();
        }
        List<Long> conflictIds = availabilityResult.conflicts().stream()
                .map(ConflictItem::eventId)
                .filter(Objects::nonNull)
                .filter(id -> ignoreEventId == null || !ignoreEventId.equals(id))
                .toList();

        if (conflictIds.isEmpty()) {
            return List.of();
        }

        List<Event> conflictingEvents = eventRepository.findAllById(conflictIds);
        boolean hasTie = conflictingEvents.stream().anyMatch(event -> event.getPriority() == Priority.HIGH);
        if (hasTie) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "PRIORITY_TIE");
        }

        return conflictingEvents.stream()
                .filter(event -> priorityPolicy.isHigher(desiredPriority, event.getPriority()))
                .toList();
    }

    private void auditOkChanges(Event event,
                                User actor,
                                boolean previousCer,
                                boolean currentCer,
                                boolean previousTech,
                                boolean currentTech,
                                String reason,
                                String note) {
        if (previousCer != currentCer) {
            auditService.recordFieldUpdate(
                    event,
                    actor,
                    "ceremonial_ok",
                    Boolean.toString(previousCer),
                    Boolean.toString(currentCer),
                    reason,
                    note
            );
        }
        if (previousTech != currentTech) {
            auditService.recordFieldUpdate(
                    event,
                    actor,
                    "technical_ok",
                    Boolean.toString(previousTech),
                    Boolean.toString(currentTech),
                    reason,
                    note
            );
        }
    }

    private List<Status> getAllowedTransitions(Status current) {
        return ALLOWED_TRANSITIONS.getOrDefault(current, List.of());
    }

    private boolean isBlockingStatus(Status status) {
        return status == Status.RESERVADO || status == Status.APROBADO;
    }

    private void ensureOperativeRole(User user) {
        if (isAdminFull(user) || isCeremonial(user) || isTechnical(user)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ROLE_NOT_ALLOWED");
    }

    private boolean canApprove(User user) {
        return isAdminFull(user) || isCeremonial(user) || isTechnical(user);
    }

    private boolean canModifyCeremonial(User user) {
        return isAdminFull(user) || isCeremonial(user);
    }

    private boolean canModifyTechnical(User user) {
        return isAdminFull(user) || isTechnical(user);
    }

    private boolean isAdminFull(User user) {
        return "ADMIN_FULL".equalsIgnoreCase(user.getRole());
    }

    private boolean isCeremonial(User user) {
        return "ADMIN_CEREMONIAL".equalsIgnoreCase(user.getRole());
    }

    private boolean isTechnical(User user) {
        return "ADMIN_TECNICA".equalsIgnoreCase(user.getRole());
    }

    private void publishStatusChanged(Event event, Status previousStatus, User actor) {
        if (event == null || previousStatus == null || actor == null) {
            return;
        }
        if (previousStatus != event.getStatus()) {
            eventPublisher.publishEvent(new EventStatusChangedEvent(
                event.getId(),
                previousStatus,
                event.getStatus(),
                actor.getId()
            ));
        }
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user");
        }
        Object principal = authentication.getPrincipal();
        Long userId;
        if (principal instanceof com.mvp.backend.feature.auth.security.UserPrincipal userPrincipal) {
            userId = userPrincipal.getId();
        } else if (principal instanceof org.springframework.security.core.userdetails.UserDetails details) {
            userId = userService.getByUsername(details.getUsername()).getId();
        } else if (principal instanceof String username) {
            userId = userService.getByUsername(username).getId();
        } else {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user");
        }
        return userService.getById(userId);
    }

    private static Map<Status, List<Status>> buildTransitions() {
        Map<Status, List<Status>> map = new EnumMap<>(Status.class);
        map.put(Status.SOLICITADO, List.of(Status.EN_REVISION));
        map.put(Status.EN_REVISION, List.of(Status.RESERVADO, Status.RECHAZADO, Status.APROBADO));
        map.put(Status.RESERVADO, List.of(Status.APROBADO, Status.RECHAZADO, Status.EN_REVISION));
        map.put(Status.APROBADO, List.of(Status.EN_REVISION));
        map.put(Status.RECHAZADO, Collections.emptyList());
        return map;
    }
}
