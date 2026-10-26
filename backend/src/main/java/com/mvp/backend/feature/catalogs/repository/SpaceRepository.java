package com.mvp.backend.feature.catalogs.repository;

import com.mvp.backend.feature.catalogs.model.Space;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SpaceRepository extends JpaRepository<Space, Long> {
    boolean existsByName(String name);

    Page<Space> findByNameContainingIgnoreCase(String name, Pageable pageable);

    Page<Space> findByActive(boolean active, Pageable pageable);

    Page<Space> findByActiveAndNameContainingIgnoreCase(boolean active, String name, Pageable pageable);

    List<Space> findByActiveTrueOrderByNameAsc();

    /** Bloqueo de la fila del espacio: serializa la ocupación de un mismo espacio (REV-15). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Space s where s.id = :id")
    Optional<Space> findByIdForUpdate(@Param("id") Long id);
}