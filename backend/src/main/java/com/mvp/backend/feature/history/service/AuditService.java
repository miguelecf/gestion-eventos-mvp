package com.mvp.backend.feature.history.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.history.dto.AuditEntryDto;
import com.mvp.backend.feature.history.dto.AuditPageDto;
import com.mvp.backend.feature.history.model.EventHistory;
import com.mvp.backend.feature.history.model.HistoryType;
import com.mvp.backend.feature.history.repository.EventHistoryRepository;
import com.mvp.backend.feature.users.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuditService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final EventHistoryRepository repository;

    public void recordStatusChange(Event event,
                                   User actor,
                                   Status from,
                                   Status to,
                                   String reason,
                                   String note) {
        repository.save(baseBuilder(event, actor)
                .type(HistoryType.STATUS)
                .field("status")
                .fromValue(from != null ? from.name() : null)
                .toValue(to != null ? to.name() : null)
                .reason(trimToNull(reason))
                .note(trimToNull(note))
                .build());
    }

    public void recordScheduleChange(Event event,
                                     User actor,
                                     LocalDate date,
                                     LocalTime from,
                                     LocalTime to) {
        repository.save(baseBuilder(event, actor)
                .type(HistoryType.SCHEDULE_CHANGE)
                .field("schedule")
                .details(buildScheduleDetails(date, from, to))
                .build());
    }

    public void recordReprogram(Event event,
                                User actor,
                                LocalDate date,
                                LocalTime from,
                                LocalTime to,
                                String reason,
                                String note) {
        repository.save(baseBuilder(event, actor)
                .type(HistoryType.REPROGRAM)
                .field("schedule")
                .details(buildScheduleDetails(date, from, to))
                .reason(trimToNull(reason))
                .note(trimToNull(note))
                .build());
    }

    /** Baja lógica del evento (soft-delete): queda registrado quién y cuándo lo desactivó. */
    public void recordDeleted(Event event, User actor) {
        repository.save(baseBuilder(event, actor)
                .type(HistoryType.EVENT_DELETED)
                .field("active")
                .fromValue("true")
                .toValue("false")
                .build());
    }

    public void recordFieldUpdate(Event event,
                                  User actor,
                                  String field,
                                  String from,
                                  String to,
                                  String reason,
                                  String note) {
        repository.save(baseBuilder(event, actor)
                .type(HistoryType.FIELD_UPDATE)
                .field(field)
                .fromValue(abbreviate(from))
                .toValue(abbreviate(to))
                .reason(trimToNull(reason))
                .note(trimToNull(note))
                .build());
    }

    /**
     * Conflicto de prioridad sobre el evento DESPLAZADO (hallazgo 4.6): se registra al abrirse
     * (OPEN) y al resolverse (CLOSED, con la decisión y su motivo).
     */
    public void recordPriorityConflict(Event displaced,
                                       User actor,
                                       String conflictCode,
                                       String fromState,
                                       String toState,
                                       String details,
                                       String reason) {
        repository.save(baseBuilder(displaced, actor)
                .type(HistoryType.PRIORITY_CONFLICT)
                .field(conflictCode)
                .fromValue(fromState)
                .toValue(toState)
                .details(trimToNull(details))
                .reason(trimToNull(reason))
                .build());
    }

    public void recordCommentCreated(Event event,
                                     User actor,
                                     Long commentId,
                                     Long authorId,
                                     String body) {
        repository.save(baseBuilder(event, actor)
                .type(HistoryType.COMMENT_CREATED)
                .details(buildCommentPayload(commentId, authorId, null, commentSnapshot(body)))
                .build());
    }

    public void recordCommentUpdated(Event event,
                                     User actor,
                                     Long commentId,
                                     Long authorId,
                                     String previousBody,
                                     String currentBody) {
        repository.save(baseBuilder(event, actor)
                .type(HistoryType.COMMENT_UPDATED)
                .details(buildCommentPayload(commentId, authorId, commentSnapshot(previousBody), commentSnapshot(currentBody)))
                .build());
    }

    public void recordCommentDeleted(Event event,
                                     User actor,
                                     Long commentId,
                                     Long authorId,
                                     String body) {
        repository.save(baseBuilder(event, actor)
                .type(HistoryType.COMMENT_DELETED)
                .details(buildCommentPayload(commentId, authorId, commentSnapshot(body), null))
                .build());
    }

    public void recordInternalToggle(Event event,
                                     User actor,
                                     boolean previous,
                                     boolean next) {
        if (previous == next) {
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("prev", previous);
        payload.put("next", next);
        repository.save(baseBuilder(event, actor)
                .type(HistoryType.INTERNAL_TOGGLED)
                .details(toJson(payload))
                .build());
    }

    public AuditPageDto getEventHistory(Long eventId, HistoryType type, Pageable pageable) {
        Page<EventHistory> page = repository.findByEventIdAndTypeOrderByAtDesc(eventId, type, pageable);
        List<AuditEntryDto> entries = page.getContent().stream()
                .map(this::toDto)
                .toList();
        return new AuditPageDto(
                eventId,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                entries
        );
    }

    private AuditEntryDto toDto(EventHistory history) {
        AuditEntryDto.UserRef actorRef = null;
        User actor = history.getActor();
        if (actor != null) {
            actorRef = new AuditEntryDto.UserRef(
                    actor.getId(),
                    actor.getUsername(),
                    actor.getName(),
                    actor.getLastName(),
                    actor.getEmail()
            );
        }
        return new AuditEntryDto(
                history.getId(),
                history.getType(),
                history.getAt(),
                history.getField(),
                history.getFromValue(),
                history.getToValue(),
                history.getDetails(),
                history.getReason(),
                history.getNote(),
                actorRef
        );
    }

    private EventHistory.EventHistoryBuilder baseBuilder(Event event, User actor) {
        return EventHistory.builder()
                .event(event)
                .actor(actor)
                .at(Instant.now());
    }

    private String buildScheduleDetails(LocalDate date, LocalTime from, LocalTime to) {
        List<String> parts = new ArrayList<>();
        if (date != null) {
            parts.add("Fecha " + date);
        }
        if (from != null && to != null) {
            parts.add("Horario " + from.format(TIME_FORMATTER) + "-" + to.format(TIME_FORMATTER));
        }
        return parts.isEmpty() ? null : String.join(" | ", parts);
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String buildCommentPayload(Long commentId,
                                       Long authorId,
                                       Map<String, Object> prev,
                                       Map<String, Object> next) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("commentId", commentId);
        payload.put("authorId", authorId);
        if (prev != null) {
            payload.put("prev", prev);
        }
        if (next != null) {
            payload.put("next", next);
        }
        return toJson(payload);
    }

    private Map<String, Object> commentSnapshot(String body) {
        if (body == null) {
            return null;
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("body", body);
        snapshot.put("visibility", "INTERNAL");
        return snapshot;
    }

    private String toJson(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize audit payload", e);
        }
    }

    /** from_value/to_value son VARCHAR(256): textos largos (observaciones, requerimientos) se recortan. */
    private String abbreviate(String value) {
        if (value == null || value.length() <= 256) {
            return value;
        }
        return value.substring(0, 253) + "...";
    }
}
