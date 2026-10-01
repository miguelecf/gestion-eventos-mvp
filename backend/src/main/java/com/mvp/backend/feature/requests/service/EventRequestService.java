package com.mvp.backend.feature.requests.service;

import com.mvp.backend.feature.availability.exception.AvailabilityConflictException;
import com.mvp.backend.feature.availability.model.AvailabilityParams;
import com.mvp.backend.feature.availability.service.AvailabilityService;
import com.mvp.backend.feature.catalogs.model.Department;
import com.mvp.backend.feature.catalogs.model.Space;
import com.mvp.backend.feature.catalogs.repository.DepartmentRepository;
import com.mvp.backend.feature.catalogs.repository.SpaceRepository;
import com.mvp.backend.feature.events.dto.EventResponseDto;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.events.repository.EventRepository;
import com.mvp.backend.feature.events.service.EventMapper;
import com.mvp.backend.feature.history.model.HistoryType;
import com.mvp.backend.feature.history.model.EventHistory;
import com.mvp.backend.feature.history.model.EventRequestHistory;
import com.mvp.backend.feature.history.repository.EventHistoryRepository;
import com.mvp.backend.feature.history.repository.EventRequestHistoryRepository;
import com.mvp.backend.feature.requests.dto.ChangeRequestStatusDto;
import com.mvp.backend.feature.requests.dto.CreateEventRequestDto;
import com.mvp.backend.feature.requests.dto.EventRequestCreatedDto;
import com.mvp.backend.feature.requests.dto.EventRequestResponseDto;
import com.mvp.backend.feature.requests.dto.TrackingResponse;
import com.mvp.backend.feature.requests.dto.RequestHistoryEntryDto;
import com.mvp.backend.feature.requests.dto.ConvertRequestToEventDto;
import com.mvp.backend.feature.events.model.TechSupportMode;
import com.mvp.backend.feature.tech.service.TechCapacityService;
import com.mvp.backend.feature.tech.exception.TechCapacityExceededException;
import com.mvp.backend.feature.requests.dto.TrackingResponse.EventData;
import com.mvp.backend.feature.requests.dto.TrackingResponse.LocationData;
import com.mvp.backend.feature.requests.dto.TrackingResponse.LocationData.LocationType;
import com.mvp.backend.feature.requests.dto.TrackingResponse.RequestData;
import com.mvp.backend.feature.requests.dto.TrackingResponse.ScheduleData;
import com.mvp.backend.feature.requests.dto.TrackingResponse.TimelineEntry;
import com.mvp.backend.feature.requests.dto.TrackingResponse.TimelineEntry.Scope;
import com.mvp.backend.feature.requests.dto.TrackingResponse.TimelineEntry.Type;
import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.feature.requests.model.RequestStatus;
import com.mvp.backend.feature.requests.repository.EventRequestRepository;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.users.service.UserService;
import com.mvp.backend.feature.auth.security.UserPrincipal;
import com.mvp.backend.feature.notifications.event.EventRequestCreatedEmailEvent;
import com.mvp.backend.shared.DomainValidationException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EventRequestService {

    private final EventRequestRepository eventRequestRepository;
    private final SpaceRepository spaceRepository;
    private final DepartmentRepository departmentRepository;
    private final EventRequestHistoryRepository eventRequestHistoryRepository;
    private final EventHistoryRepository eventHistoryRepository;
    private final AvailabilityService availabilityService;
    private final ApplicationEventPublisher eventPublisher;
    private final EventRepository eventRepository;
    private final UserService userService;
    private final TechCapacityService techCapacityService;

    @Transactional
    public EventRequestCreatedDto create(CreateEventRequestDto dto) {
        validateSchedule(dto);
        validateLocation(dto);
        validateBuffers(dto);

        Space space = null;
        if (dto.spaceId() != null) {
            space = spaceRepository.findById(dto.spaceId())
                    .filter(Space::isActive)
                    .orElseThrow(() -> new EntityNotFoundException("Space not found"));
        }
        // chequeo si hay espacio disponible
        Integer resolvedBufferBefore = resolveBufferBefore(dto, space);
        Integer resolvedBufferAfter = resolveBufferAfter(dto, space);

        String freeLocation = trimToNull(dto.freeLocation());

        var availabilityParams = AvailabilityParams.builder()
                .date(dto.date())
                .spaceId(dto.spaceId())
                .freeLocation(freeLocation)
                .scheduleFrom(dto.scheduleFrom())
                .scheduleTo(dto.scheduleTo())
                .bufferBeforeMin(resolvedBufferBefore)
                .bufferAfterMin(resolvedBufferAfter)
                .build();

        var availabilityResult = availabilityService.checkSpaceAvailability(availabilityParams);
        if (Boolean.FALSE.equals(availabilityResult.isAvailable())) {
            throw AvailabilityConflictException.publicConflict(availabilityResult);
        }

        Department department = null;
        if (dto.requestingDepartmentId() != null) {
            department = departmentRepository.findById(dto.requestingDepartmentId())
                    .orElseThrow(() -> new EntityNotFoundException("Department not found"));
        }

        String contactPhone = dto.contactPhone().trim();
        String contactEmail = dto.contactEmail().trim();
        String contactName = dto.contactName().trim();
        String name = dto.name().trim();

        EventRequest request = EventRequest.builder()
                .trackingUuid(generateTrackingUuid())
                .date(dto.date())
                .technicalSchedule(dto.technicalSchedule())
                .scheduleFrom(dto.scheduleFrom())
                .scheduleTo(dto.scheduleTo())
                .name(name)
                .space(space)
                .freeLocation(freeLocation)
                .requestingDepartment(department)
                .requirements(trimToNull(dto.requirements()))
                .coverage(trimToNull(dto.coverage()))
                .observations(trimToNull(dto.observations()))
                .priority(dto.priority())
                .audienceType(dto.audienceType())
                .contactName(contactName)
                .contactEmail(contactEmail)
                .contactPhone(contactPhone)
                .bufferBeforeMin(resolvedBufferBefore)
                .bufferAfterMin(resolvedBufferAfter)
                .status(RequestStatus.RECIBIDO)
                .requestDate(Instant.now())
                .build();

        EventRequest saved = eventRequestRepository.save(request);

        eventRequestHistoryRepository.save(EventRequestHistory.builder()
                .request(saved)
                .at(saved.getRequestDate())
                .type(HistoryType.STATUS)
                .fromValue(null)
                .toValue(saved.getStatus().name())
                .build());

        eventPublisher.publishEvent(new EventRequestCreatedEmailEvent(saved.getId()));

        return new EventRequestCreatedDto(saved.getTrackingUuid(), saved.getStatus(), saved.getRequestDate());
    }

    @Transactional(readOnly = true)
    public TrackingResponse getTracking(String trackingUuid) {
        EventRequest request = eventRequestRepository.findByTrackingUuid(trackingUuid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tracking token not found"));

        Event event = request.getConvertedEvent();
        RequestStatus requestStatus = event != null ? RequestStatus.CONVERTIDO : request.getStatus();
        RequestData requestData = new RequestData(requestStatus, request.getRequestDate());

        // Si la solicitud ya se convirtió, la agenda/ubicación vigente es la del evento.
        EventData eventData = event != null ? new EventData(event.getStatus()) : null;
        ScheduleData scheduleData = event != null
                ? new ScheduleData(event.getDate(), event.getScheduleFrom(), event.getScheduleTo())
                : new ScheduleData(request.getDate(), request.getScheduleFrom(), request.getScheduleTo());
        LocationData locationData = event != null
                ? toLocationData(event.getSpace(), event.getFreeLocation())
                : toLocationData(request.getSpace(), request.getFreeLocation());

        return new TrackingResponse(
                request.getTrackingUuid(),
                request.getName(),
                rejectionReason(request, requestStatus),
                requestData,
                eventData,
                scheduleData,
                locationData,
                buildTimeline(request, event));
    }

    private Integer resolveBufferBefore(CreateEventRequestDto dto, Space space) {
        if (dto.bufferBeforeMin() != null) {
            if (dto.bufferBeforeMin() < 0 || dto.bufferBeforeMin() > 240) {
                throw new DomainValidationException("bufferBeforeMin must be between 0 and 240");
            }
            return dto.bufferBeforeMin();
        }
        return space != null ? space.getDefaultBufferBeforeMin() : 0;
    }

    private Integer resolveBufferAfter(CreateEventRequestDto dto, Space space) {
        if (dto.bufferAfterMin() != null) {
            if (dto.bufferAfterMin() < 0 || dto.bufferAfterMin() > 240) {
                throw new DomainValidationException("bufferAfterMin must be between 0 and 240");
            }
            return dto.bufferAfterMin();
        }
        return space != null ? space.getDefaultBufferAfterMin() : 0;
    }

    /**
     * Línea temporal pública: sólo cambios de estado y de agenda, sin {@code details}.
     * Comentarios internos, toggles de visibilidad, conformidades y demás auditoría
     * quedan fuera del contrato público (hallazgos 1.1 y 1.3).
     */
    private List<TimelineEntry> buildTimeline(EventRequest request, Event event) {
        List<TimelineEntry> entries = new ArrayList<>();

        for (EventRequestHistory history : eventRequestHistoryRepository.findByRequestIdOrderByAtAsc(request.getId())) {
            Type type = toPublicType(history.getType());
            if (type != null) {
                entries.add(new TimelineEntry(history.getAt(), Scope.REQUEST, type,
                        publicValue(type, history.getFromValue()), publicValue(type, history.getToValue())));
            }
        }

        if (event != null) {
            for (EventHistory history : eventHistoryRepository.findByEventIdOrderByAtAsc(event.getId())) {
                Type type = toPublicType(history.getType());
                if (type != null) {
                    entries.add(new TimelineEntry(history.getAt(), Scope.EVENT, type,
                            publicValue(type, history.getFromValue()), publicValue(type, history.getToValue())));
                }
            }
        }

        entries.sort(Comparator.comparing(TimelineEntry::at));
        return List.copyOf(entries);
    }

    /** Motivo de rechazo de la solicitud, redactado para el solicitante. */
    private String rejectionReason(EventRequest request, RequestStatus status) {
        if (status != RequestStatus.RECHAZADO) {
            return null;
        }
        return eventRequestHistoryRepository.findByRequestIdOrderByAtAsc(request.getId()).stream()
                .filter(h -> RequestStatus.RECHAZADO.name().equals(h.getToValue()) && h.getReason() != null)
                .reduce((first, second) -> second)
                .map(EventRequestHistory::getReason)
                .orElse(null);
    }

    private Type toPublicType(HistoryType type) {
        return switch (type) {
            case STATUS -> Type.STATUS;
            case SCHEDULE_CHANGE, REPROGRAM -> Type.SCHEDULE_CHANGE;
            default -> null;
        };
    }

    /** Los valores from/to sólo se exponen para estados; un cambio de agenda se informa sin detalle. */
    private String publicValue(Type type, String value) {
        return type == Type.STATUS ? value : null;
    }

    private LocationData toLocationData(Space space, String freeLocation) {
        if (space != null) {
            return new LocationData(LocationType.SPACE, space.getName(), null);
        }
        return new LocationData(LocationType.FREE, null, trimToNull(freeLocation));
    }

    private void validateBuffers(CreateEventRequestDto dto) {
        if (dto.bufferBeforeMin() == null || dto.bufferBeforeMin() < 0 || dto.bufferBeforeMin() > 240) {
            throw new DomainValidationException("bufferBeforeMin must be between 0 and 240");
        }
        if (dto.bufferAfterMin() == null || dto.bufferAfterMin() < 0 || dto.bufferAfterMin() > 240) {
            throw new DomainValidationException("bufferAfterMin must be between 0 and 240");
        }
    }

    private void validateLocation(CreateEventRequestDto dto) {
        boolean hasSpaceId = dto.spaceId() != null;
        boolean hasFreeLocation = dto.freeLocation() != null && !dto.freeLocation().isBlank();
        if (hasSpaceId == hasFreeLocation) {
            throw new DomainValidationException("Either space_id or free_location must be provided, but not both");
        }
    }

    private void validateSchedule(CreateEventRequestDto dto) {
        if (dto.scheduleFrom() != null && dto.scheduleTo() != null && !dto.scheduleFrom().isBefore(dto.scheduleTo())) {
            throw new DomainValidationException("scheduleFrom must be before scheduleTo");
        }
    }

    private String trimToNull(String value) {
        return Optional.ofNullable(value)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .orElse(null);
    }

    private String generateTrackingUuid() {
        String uuid;
        do {
            uuid = UUID.randomUUID().toString();
        } while (eventRequestRepository.existsByTrackingUuid(uuid));
        return uuid;
    }

    /* ---------- Admin ---------- */

    /** Historial completo de una solicitud con actor y motivo (hallazgos 4.1 / 4.2). */
    @Transactional(readOnly = true)
    public List<RequestHistoryEntryDto> getAdminHistory(Long id) {
        if (!eventRequestRepository.existsById(id)) {
            throw new EntityNotFoundException("EventRequest not found with id: " + id);
        }
        return eventRequestHistoryRepository.findByRequestIdOrderByAtAsc(id).stream()
                .map(h -> new RequestHistoryEntryDto(
                        h.getId(), h.getAt(), h.getType(), h.getFromValue(), h.getToValue(), h.getReason(),
                        h.getActor() == null ? null : new RequestHistoryEntryDto.ActorRef(
                                h.getActor().getId(), h.getActor().getUsername(),
                                h.getActor().getName(), h.getActor().getLastName())))
                .toList();
    }

    /** Bandeja administrativa: todas las solicitudes activas (cualquier estado), más recientes primero. */
    @Transactional(readOnly = true)
    public List<EventRequestResponseDto> listAdmin(List<RequestStatus> statuses) {
        List<EventRequest> requests = statuses == null || statuses.isEmpty()
                ? eventRequestRepository.findByActiveTrueOrderByRequestDateDesc()
                : eventRequestRepository.findByActiveTrueAndStatusInOrderByRequestDateDesc(statuses);
        return requests.stream().map(EventRequestMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public EventRequestResponseDto getAdminById(Long id) {
        EventRequest request = eventRequestRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("EventRequest not found with id: " + id));
        return EventRequestMapper.toDto(request);
    }

    @Transactional
    public EventRequestResponseDto changeStatus(Long id, ChangeRequestStatusDto dto) {
        EventRequest request = eventRequestRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("EventRequest not found with id: " + id));

        RequestStatus current = request.getStatus();
        RequestStatus newStatus = dto.newStatus();

        if (current == RequestStatus.CONVERTIDO) {
            throw new DomainValidationException("Cannot change status of a converted request");
        }
        if (current == RequestStatus.RECHAZADO) {
            throw new DomainValidationException("Cannot reopen a rejected request");
        }
        if (newStatus == RequestStatus.CONVERTIDO) {
            throw new DomainValidationException("Use the convert-to-event endpoint to convert a request");
        }

        validateStatusTransition(current, newStatus);

        // Rechazar exige motivo; se guarda en el historial (no pisa las observaciones del solicitante).
        String reason = trimToNull(dto.reason());
        if (newStatus == RequestStatus.RECHAZADO && reason == null) {
            throw new DomainValidationException("Debe indicar el motivo del rechazo");
        }

        String fromValue = current.name();
        User actor = getCurrentUser();

        if (newStatus == RequestStatus.EN_REVISION) {
            request.setReviewedAt(Instant.now());
            request.setReviewedBy(actor.getUsername());
        }

        request.setStatus(newStatus);
        EventRequest saved = eventRequestRepository.save(request);

        eventRequestHistoryRepository.save(EventRequestHistory.builder()
                .request(saved)
                .at(Instant.now())
                .type(HistoryType.STATUS)
                .actor(actor)
                .fromValue(fromValue)
                .toValue(saved.getStatus().name())
                .reason(newStatus == RequestStatus.RECHAZADO ? reason : null)
                .build());

        return EventRequestMapper.toDto(saved);
    }

    @Transactional
    public EventResponseDto convertToEvent(Long id, ConvertRequestToEventDto options) {
        EventRequest request = eventRequestRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("EventRequest not found with id: " + id));

        RequestStatus current = request.getStatus();
        if (current == RequestStatus.CONVERTIDO) {
            throw new DomainValidationException("Request is already converted");
        }
        if (current == RequestStatus.RECHAZADO) {
            throw new DomainValidationException("Cannot convert a rejected request");
        }
        if (current != RequestStatus.EN_REVISION) {
            throw new DomainValidationException("Only requests in EN_REVISION can be converted");
        }

        // B. Validaciones de fecha y horario
        if (request.getDate() == null) {
            throw new DomainValidationException("date is required to convert a request");
        }
        if (request.getScheduleFrom() == null) {
            throw new DomainValidationException("scheduleFrom is required to convert a request");
        }
        if (request.getScheduleTo() == null) {
            throw new DomainValidationException("scheduleTo is required to convert a request");
        }
        if (!request.getScheduleFrom().isBefore(request.getScheduleTo())) {
            throw new DomainValidationException("scheduleFrom must be before scheduleTo");
        }

        boolean hasSpace = request.getSpace() != null;
        boolean hasFreeLocation = request.getFreeLocation() != null && !request.getFreeLocation().isBlank();

        if (!hasSpace && !hasFreeLocation) {
            throw new DomainValidationException("Request must have either space or freeLocation");
        }

        if (hasSpace && hasFreeLocation) {
            throw new DomainValidationException("Request cannot have both space and freeLocation");
        }

        // C. Validación de espacio activo
        if (request.getSpace() != null && !request.getSpace().isActive()) {
            throw new DomainValidationException("Cannot convert request: associated space is inactive");
        }

        // D. Check de disponibilidad al convertir
        if (request.getSpace() != null) {
            var availabilityParams = AvailabilityParams.builder()
                    .date(request.getDate())
                    .spaceId(request.getSpace().getId())
                    .scheduleFrom(request.getScheduleFrom())
                    .scheduleTo(request.getScheduleTo())
                    .bufferBeforeMin(request.getBufferBeforeMin())
                    .bufferAfterMin(request.getBufferAfterMin())
                    .build();
            var availabilityResult = availabilityService.checkSpaceAvailability(availabilityParams);
            if (Boolean.FALSE.equals(availabilityResult.isAvailable())) {
                throw AvailabilityConflictException.internalConflict(availabilityResult);
            }
        }

        // E. Soporte técnico definido por el área al convertir (hallazgo 3.2)
        boolean requiresTech = Boolean.TRUE.equals(options.requiresTech());
        TechSupportMode techSupportMode = requiresTech && options.techSupportMode() != null
                ? options.techSupportMode() : TechSupportMode.SETUP_ONLY;
        if (requiresTech && !techCapacityService.hasCapacity(request.getDate(), request.getScheduleFrom(),
                request.getScheduleTo(), request.getBufferBeforeMin(), request.getBufferAfterMin(),
                techSupportMode, null)) {
            throw new TechCapacityExceededException("No hay capacidad técnica disponible para el rango solicitado.");
        }

        User actor = getCurrentUser();
        Instant now = Instant.now();

        Event event = Event.builder()
                .date(request.getDate())
                .technicalSchedule(request.getTechnicalSchedule())
                .scheduleFrom(request.getScheduleFrom())
                .scheduleTo(request.getScheduleTo())
                .status(Status.EN_REVISION)
                .name(request.getName())
                .space(request.getSpace())
                .freeLocation(request.getFreeLocation())
                .department(request.getRequestingDepartment())
                .requirements(request.getRequirements())
                .coverage(request.getCoverage())
                .observations(request.getObservations())
                .priority(request.getPriority())
                .audienceType(request.getAudienceType())
                .bufferBeforeMin(request.getBufferBeforeMin())
                .bufferAfterMin(request.getBufferAfterMin())
                .contactName(request.getContactName())
                .contactEmail(request.getContactEmail())
                .contactPhone(request.getContactPhone())
                .internal(false)
                .requiresTech(requiresTech)
                .techSupportMode(techSupportMode)
                .createdBy(actor)
                .build();

        Event savedEvent = eventRepository.save(event);

        eventHistoryRepository.save(EventHistory.builder()
                .event(savedEvent)
                .actor(actor)
                .at(now)
                .type(HistoryType.STATUS)
                .field("status")
                .fromValue(null)
                .toValue(Status.EN_REVISION.name())
                .build());

        String fromStatus = request.getStatus().name();
        request.setConvertedEvent(savedEvent);
        request.setConvertedAt(now);
        request.setConvertedBy(actor.getUsername());
        request.setStatus(RequestStatus.CONVERTIDO);
        EventRequest savedRequest = eventRequestRepository.save(request);

        eventRequestHistoryRepository.save(EventRequestHistory.builder()
                .request(savedRequest)
                .at(now)
                .type(HistoryType.STATUS)
                .actor(actor)
                .fromValue(fromStatus)
                .toValue(RequestStatus.CONVERTIDO.name())
                .build());

        return EventMapper.toDto(savedEvent);
    }

    private void validateStatusTransition(RequestStatus from, RequestStatus to) {
        boolean valid = switch (from) {
            case RECIBIDO -> to == RequestStatus.EN_REVISION || to == RequestStatus.RECHAZADO;
            case EN_REVISION -> to == RequestStatus.RECHAZADO;
            default -> false;
        };
        if (!valid) {
            throw new DomainValidationException("Invalid status transition: " + from + " -> " + to);
        }
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user");
        }
        Object principal = authentication.getPrincipal();
        Long userId;
        if (principal instanceof UserPrincipal userPrincipal) {
            userId = userPrincipal.getId();
        } else if (principal instanceof UserDetails details) {
            userId = userService.getByUsername(details.getUsername()).getId();
        } else if (principal instanceof String username) {
            userId = userService.getByUsername(username).getId();
        } else {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user");
        }
        return userService.getById(userId);
    }
}
