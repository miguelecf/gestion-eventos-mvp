package com.mvp.backend.feature.tech.repository;

import com.mvp.backend.feature.tech.model.TechCapacityConfig;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TechCapacityConfigRepository extends JpaRepository<TechCapacityConfig, Long> {

    /**
     * Configuración vigente: si por error hubiera varias activas, gana la más reciente (mayor id),
     * de forma determinística. La configuración se gestiona por migración Flyway (ver docs/historial/hallazgos-2026-10.md, 3.5).
     */
    Optional<TechCapacityConfig> findFirstByActiveTrueOrderByIdDesc();

    /**
     * Igual que {@link #findFirstByActiveTrueOrderByIdDesc()} pero con SELECT ... FOR UPDATE:
     * serializa las operaciones que consumen capacidad técnica hasta el commit (hallazgo 5.2).
     * Usar con {@code PageRequest.of(0, 1)}.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from TechCapacityConfig c where c.active = true order by c.id desc")
    List<TechCapacityConfig> findActiveForUpdate(Pageable pageable);
}