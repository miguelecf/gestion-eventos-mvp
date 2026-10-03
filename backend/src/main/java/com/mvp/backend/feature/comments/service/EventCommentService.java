package com.mvp.backend.feature.comments.service;

import com.mvp.backend.feature.comments.dto.CommentCreateDto;
import com.mvp.backend.feature.comments.dto.CommentPageDto;
import com.mvp.backend.feature.comments.dto.CommentResponseDto;
import com.mvp.backend.feature.comments.dto.CommentUpdateDto;
import com.mvp.backend.feature.comments.mapper.EventCommentMapper;
import com.mvp.backend.feature.comments.model.CommentVisibility;
import com.mvp.backend.feature.comments.model.EventComment;
import com.mvp.backend.feature.comments.repository.EventCommentRepository;
import com.mvp.backend.feature.auth.security.CurrentUserService;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.repository.EventRepository;
import com.mvp.backend.feature.history.service.AuditService;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.notifications.event.NewCommentEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@Service
@Transactional
public class EventCommentService {

    private static final Set<String> PRIVILEGED_ROLES = Set.of(
            "ROLE_ADMIN_FULL",
            "ROLE_ADMIN_CEREMONIAL",
            "ROLE_ADMIN_TECNICA");

    private final EventRepository eventRepository;
    private final EventCommentRepository commentRepository;
    private final EventCommentMapper mapper;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final ApplicationEventPublisher eventPublisher;

    public EventCommentService(EventRepository eventRepository,
            EventCommentRepository commentRepository,
            EventCommentMapper mapper,
            AuditService auditService,
            CurrentUserService currentUserService,
            ApplicationEventPublisher eventPublisher) {
        this.eventRepository = eventRepository;
        this.commentRepository = commentRepository;
        this.mapper = mapper;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public CommentPageDto list(Long eventId, Pageable pageable) {
        Event event = getEventOrThrow(eventId);
        Page<EventComment> page = commentRepository.findByEventIdAndDeletedAtIsNull(event.getId(), pageable);
        List<CommentResponseDto> items = page.getContent()
                .stream()
                .map(mapper::toResponse)
                .toList();
        return new CommentPageDto(
                event.getId(),
                items,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements());
    }

    public CommentResponseDto create(Long eventId, CommentCreateDto dto) {
        Event event = getEventOrThrow(eventId);
        User currentUser = currentUserService.get();
        String normalizedBody = normalizeBody(dto.body());

        EventComment comment = EventComment.builder()
                .event(event)
                .author(currentUser)
                .body(normalizedBody)
                .visibility(CommentVisibility.INTERNAL)
                .build();

        EventComment saved = commentRepository.save(comment);
        auditService.recordCommentCreated(event, currentUser, saved.getId(), currentUser.getId(), saved.getBody());
        eventPublisher.publishEvent(new NewCommentEvent(event.getId(), saved.getId(), currentUser.getId()));
        return mapper.toResponse(saved);
    }

    public CommentResponseDto update(Long eventId, Long commentId, CommentUpdateDto dto) {
        EventComment comment = getEditableComment(eventId, commentId);
        User currentUser = currentUserService.get();
        verifyAuthorOrPrivileged(comment.getAuthor(), currentUser);

        String normalizedBody = normalizeBody(dto.body());
        String previousBody = comment.getBody();

        comment.setBody(normalizedBody);
        comment.setEditedBy(currentUser);
        comment.setVisibility(CommentVisibility.INTERNAL);

        EventComment saved = commentRepository.save(comment);
        Long authorId = comment.getAuthor() != null ? comment.getAuthor().getId() : null;
        auditService.recordCommentUpdated(comment.getEvent(), currentUser, comment.getId(), authorId, previousBody,
                normalizedBody);
        return mapper.toResponse(saved);
    }

    public void softDelete(Long eventId, Long commentId) {
        EventComment comment = getEditableComment(eventId, commentId);
        User currentUser = currentUserService.get();
        verifyAuthorOrPrivileged(comment.getAuthor(), currentUser);

        comment.setDeletedAt(Instant.now());
        comment.setActive(false);
        commentRepository.save(comment);
        Long authorId = comment.getAuthor() != null ? comment.getAuthor().getId() : null;
        auditService.recordCommentDeleted(comment.getEvent(), currentUser, comment.getId(), authorId,
                comment.getBody());
    }

    private EventComment getEditableComment(Long eventId, Long commentId) {
        EventComment comment = commentRepository.findByIdAndEventIdAndDeletedAtIsNull(commentId, eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));
        if (!comment.getEvent().isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found");
        }
        return comment;
    }

    private Event getEventOrThrow(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));
        if (!event.isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found");
        }
        return event;
    }

    private String normalizeBody(String body) {
        if (!StringUtils.hasText(body)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment body must not be empty");
        }
        String trimmed = body.trim();
        if (trimmed.length() > 2500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment body exceeds 2500 characters");
        }
        return trimmed;
    }

    private void verifyAuthorOrPrivileged(User author, User currentUser) {
        if (author != null && author.getId().equals(currentUser.getId())) {
            return;
        }
        if (!isPrivileged(SecurityContextHolder.getContext().getAuthentication())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to manage this comment");
        }
    }

    private boolean isPrivileged(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (PRIVILEGED_ROLES.contains(authority.getAuthority())) {
                return true;
            }
        }
        return false;
    }

}
