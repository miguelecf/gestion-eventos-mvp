package com.mvp.backend.feature.notifications.service;

import com.mvp.backend.feature.comments.model.EventComment;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.notifications.dto.CreateNotificationDto;
import com.mvp.backend.feature.notifications.model.NotificationType;
import com.mvp.backend.feature.priority.model.PriorityConflict;
import com.mvp.backend.feature.users.model.User;
import org.springframework.stereotype.Component;

/**
 * Factory para generar DTOs de notificaciones con mensajes consistentes.
 */
@Component
public class NotificationFactory {

    public CreateNotificationDto eventStatusChanged(
            User recipient,
            Event event,
            Status oldStatus,
            Status newStatus) {
        return CreateNotificationDto.builder()
                .userId(recipient.getId())
                .type(NotificationType.EVENT_STATUS_CHANGED)
                .title("Cambio de estado en evento")
                .body(String.format(
                        "El evento '%s' cambio de %s a %s",
                        truncate(event.getName(), 80),
                        formatStatus(oldStatus),
                        formatStatus(newStatus)))
                .eventId(event.getId())
                .actionUrl("/events/" + event.getId())
                .build();
    }

    public CreateNotificationDto newCommentOnEvent(
            User recipient,
            Event event,
            EventComment comment) {
        String authorName = comment.getAuthor() != null
                ? (comment.getAuthor().getName() + " " + comment.getAuthor().getLastName()).trim()
                : "Alguien";

        return CreateNotificationDto.builder()
                .userId(recipient.getId())
                .type(NotificationType.NEW_COMMENT_ON_EVENT)
                .title("Nuevo comentario en tu evento")
                .body(String.format(
                        "%s comento en '%s': %s",
                        truncate(authorName, 40),
                        truncate(event.getName(), 60),
                        truncate(comment.getBody(), 100)))
                .eventId(event.getId())
                .commentId(comment.getId())
                .actionUrl("/events/" + event.getId() + "#comments")
                .build();
    }

    public CreateNotificationDto priorityConflictDetected(
            User recipient,
            PriorityConflict conflict) {
        Event displacedEvent = conflict.getDisplacedEvent();
        Event highEvent = conflict.getHighEvent();

        return CreateNotificationDto.builder()
                .userId(recipient.getId())
                .type(NotificationType.PRIORITY_CONFLICT_DETECTED)
                .title("Conflicto de prioridad detectado")
                .body(String.format(
                        "Tu evento '%s' tiene un conflicto de prioridad con '%s'",
                        truncate(displacedEvent.getName(), 60),
                        truncate(highEvent.getName(), 60)))
                .eventId(displacedEvent.getId())
                .actionUrl("/events/" + displacedEvent.getId())
                .build();
    }

    private String truncate(String text, int maxLength) {
        if (text == null) {
            return "";
        }
        return text.length() > maxLength
                ? text.substring(0, maxLength) + "..."
                : text;
    }

    private String formatStatus(Status status) {
        return switch (status) {
            case EN_REVISION -> "En revision";
            case RESERVADO -> "Reservado";
            case APROBADO -> "Aprobado";
            case RECHAZADO -> "Rechazado";
        };
    }
}
