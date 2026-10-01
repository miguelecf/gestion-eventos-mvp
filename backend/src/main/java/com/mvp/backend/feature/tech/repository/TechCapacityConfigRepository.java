package com.mvp.backend.feature.tech.repository;

import com.mvp.backend.feature.tech.model.TechCapacityConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TechCapacityConfigRepository extends JpaRepository<TechCapacityConfig, Long> {

    /**
     * Configuración vigente: si por error hubiera varias activas, gana la más reciente (mayor id),
     * de forma determinística. La configuración se gestiona por migración Flyway (ver docs/hallazgos-estado.md, 3.5).
     */
    Optional<TechCapacityConfig> findFirstByActiveTrueOrderByIdDesc();
}