package com.mvp.backend.feature.events.model;


import com.mvp.backend.feature.catalogs.model.Department;
import com.mvp.backend.feature.catalogs.model.Space;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.shared.AudienceType;
import com.mvp.backend.shared.BaseEntity;
import com.mvp.backend.shared.Priority;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Event extends BaseEntity {

    /** Control optimista (REV-07): una escritura sobre una versión vieja falla con 409. */
    @Version
    @Column(nullable = false)
    private Long version;

    @Column(nullable = false)
    private LocalDate date;

    @Column
    private LocalTime technicalSchedule; //horario técnico

    @Column
    private LocalTime scheduleFrom;

    @Column
    private LocalTime scheduleTo;

    @Enumerated(EnumType.STRING)
    @Column(length = 20,nullable = false)
    private Status status;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 150)
    private String requestingArea;

    // ---- Ubicación: Space o freeLocation (validar que no estén ambos)
    @ManyToOne
    @JoinColumn(name = "space_id")
    private Space space;

    @Column(length = 200)
    private String freeLocation;

    // ---- Área/departamento responsable del evento
    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(length = 255)
    private String requirements;

    @Column(columnDefinition = "TEXT")
    private String coverage;

    @Column(columnDefinition = "TEXT")
    private String observations;

    //Priority con el enum ya definido
    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private Priority priority;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private AudienceType audienceType;

    @Builder.Default
    @Column(nullable = false)
    private boolean internal = false; // excluye de calendario público

    @Builder.Default
    @Column(nullable = false)
    private boolean ceremonialOk = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean technicalOk = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean requiresTech = false;

    @Builder.Default
    @Column(name = "requires_rebooking", nullable = false)
    private boolean requiresRebooking = false;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "tech_support_mode", length = 20)
    private TechSupportMode techSupportMode = TechSupportMode.SETUP_ONLY;

    // buffers (pueden tomar defaults desde Space)
    @Builder.Default
    @Column(nullable = false)
    private Integer bufferBeforeMin = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer bufferAfterMin = 0;

    // ---- Referente/Contacto (útil para notificaciones y logística)
    @Column(length = 120)
    private String contactName;

    @Column(length = 120)
    private String contactEmail;

    @Column(length = 30)
    private String contactPhone;

    // ---- Auditoría de autoría
    @ManyToOne(optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdBy;

    @ManyToOne
    @JoinColumn(name = "last_modified_by_user_id")
    private User lastModifiedBy;
}
