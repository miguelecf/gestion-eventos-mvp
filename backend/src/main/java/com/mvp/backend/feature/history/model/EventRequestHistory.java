package com.mvp.backend.feature.history.model;

import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.requests.model.EventRequest;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "event_request_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventRequestHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private EventRequest request;

    /** Usuario interno que ejecutó la acción; null para el alta pública. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    private User actor;

    @Column(name = "at", nullable = false)
    private Instant at;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 30)
    private HistoryType type;

    @Column(name = "from_value", length = 120)
    private String fromValue;

    @Column(name = "to_value", length = 120)
    private String toValue;

    @Column(name = "details", length = 255)
    private String details;

    /** Motivo de la decisión (p.ej. rechazo). Se comunica al solicitante en el tracking. */
    @Column(name = "reason", length = 500)
    private String reason;
}