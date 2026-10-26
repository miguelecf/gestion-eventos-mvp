package com.mvp.backend.feature.requests.model;

import com.mvp.backend.feature.catalogs.model.Department;
import com.mvp.backend.feature.catalogs.model.Space;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.shared.AudienceType;
import com.mvp.backend.shared.BaseEntity;
import com.mvp.backend.shared.Priority;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "event_requests", indexes = {
                @Index(name = "uk_event_requests_token", columnList = "tracking_uuid", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventRequest extends BaseEntity {

        /** Control optimista (REV-07): una escritura sobre una versión vieja falla con 409. */
        @Version
        @Column(nullable = false)
        private Long version;

        // Token público para seguimiento
        @Column(name = "tracking_uuid", nullable = false, length = 36, unique = true)
        private String trackingUuid;

        // Info principal (mapea con orden del form)
        @Column(nullable = false)
        private LocalDate date;

        @Column
        private LocalTime technicalSchedule;

        @Column
        private LocalTime scheduleFrom;

        @Column
        private LocalTime scheduleTo;

        @Column(nullable = false, length = 200)
        private String name;

        // Espacio fisico o escrito a mano free (validar en servicio)
        @ManyToOne
        @JoinColumn(name = "space_id")
        private Space space;

        @Column(length = 200)
        private String freeLocation;

        // Solicitante / área
        @ManyToOne
        @JoinColumn(name = "requesting_department_id")
        private Department requestingDepartment;

        // Detalle
        @Column(length = 255)
        private String requirements;

        @Column(columnDefinition = "TEXT")
        private String coverage;

        @Column(columnDefinition = "TEXT")
        private String observations;

        // Meta del form
        @Enumerated(EnumType.STRING)
        @Column(nullable = false, length = 20)
        private Priority priority;

        @Enumerated(EnumType.STRING)
        @Column(nullable = false, length = 20)
        private AudienceType audienceType;

        // Contacto / referente
        @Column(nullable = false, length = 120)
        private String contactName;

        @Column(nullable = false, length = 120)
        private String contactEmail;

        @Column(length = 30)
        private String contactPhone;

        // Buffers (pueden venir del Space como default si se convierte a Event)
        @Builder.Default
        @Column(nullable = false)
        private Integer bufferBeforeMin = 0;

        @Builder.Default
        @Column(nullable = false)
        private Integer bufferAfterMin = 0;

        // Estado de la solicitud pública
        @Enumerated(EnumType.STRING)
        @Column(nullable = false, length = 20)
        private RequestStatus status;

        @Column(nullable = false)
        private Instant requestDate;

        // Campos de revisión administrativa
        @Column
        private Instant reviewedAt;

        @Column(length = 120)
        private String reviewedBy;

        @Column
        private Instant convertedAt;

        @Column(length = 120)
        private String convertedBy;

        // Si se convirtió a Event (alta interna)
        @OneToOne
        @JoinColumn(name = "converted_event_id")
        private Event convertedEvent;
}