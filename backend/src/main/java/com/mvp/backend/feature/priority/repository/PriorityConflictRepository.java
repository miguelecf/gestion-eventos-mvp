package com.mvp.backend.feature.priority.repository;

import com.mvp.backend.feature.priority.model.PriorityConflict;
import com.mvp.backend.feature.priority.model.PriorityConflictStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PriorityConflictRepository extends JpaRepository<PriorityConflict, Long> {

    Optional<PriorityConflict> findByConflictCode(String code);

    /** Conflicto bloqueado: dos decisiones simultáneas no parten de un conflicto abierto (REV-18). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from PriorityConflict c where c.conflictCode = :code")
    Optional<PriorityConflict> findByConflictCodeForUpdate(@Param("code") String code);

    List<PriorityConflict> findByHighEventIdAndStatus(Long highEventId, PriorityConflictStatus status);

    Page<PriorityConflict> findByStatus(PriorityConflictStatus status, Pageable pageable);

    @Query("select count(pc) from PriorityConflict pc where pc.date = :date")
    long countByDate(@Param("date") LocalDate date);
}
