package com.mvp.backend.feature.events.repository;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.shared.Priority;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

  // Devolver todos
  List<Event> findAll();

  /**
   * Evento con bloqueo de fila hasta el fin de la transacción: serializa los cambios de estado y
   * conformidad, para que dos áreas que actúan a la vez no pisen sus conformidades (REV-07).
   */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from Event e where e.id = :id")
  Optional<Event> findByIdForUpdate(@Param("id") Long id);

  // Consultas operativas: solo eventos activos (la baja lógica los retira de la agenda, REV-02)

  // Buscar por fecha exacta
  List<Event> findByActiveTrueAndDate(LocalDate date);

  // Buscar entre fechas
  List<Event> findByActiveTrueAndDateBetween(LocalDate startDate, LocalDate endDate);

  // Buscar por prioridad
  List<Event> findByActiveTrueAndPriority(Priority priority);

  // Buscar por estado
  List<Event> findByActiveTrueAndStatus(Status status);

  // Buscar por user
  List<Event> findByActiveTrueAndCreatedById(Long userId);

  // Buscar activo

  List<Event> findByActiveTrue();

  Page<Event> findByActiveTrue(Pageable pageable);

  List<Event> findByActiveFalse();

  List<Event> findByActiveTrueAndInternalFalse();

  List<Event> findByActiveTrueAndInternalFalseAndStatus(Status status);

  /** Eventos que pueden solaparse en un espacio entre dos fechas (incluye días adyacentes por buffers). */
  @Query("""
      select e from Event e
      where e.active = true
        and e.date between :fromDate and :toDate
        and e.space.id = :spaceId
        and e.status in :statuses
        and (:ignoreEventId is null or e.id <> :ignoreEventId)
      """)
  List<Event> findConflictingEventsBetween(@Param("fromDate") LocalDate fromDate,
                                           @Param("toDate") LocalDate toDate,
                                           @Param("spaceId") Long spaceId,
                                           @Param("statuses") List<Status> statuses,
                                           @Param("ignoreEventId") Long ignoreEventId);

  /** Eventos técnicos bloqueantes en un rango de fechas (días adyacentes por buffers, hallazgo 3.8). */
  @Query("""
      select e from Event e
      where e.active = true
        and e.date between :fromDate and :toDate
        and e.requiresTech = true
        and e.status in :statuses
        and (:ignoreEventId is null or e.id <> :ignoreEventId)
      """)
  List<Event> findTechEventsBetween(@Param("fromDate") LocalDate fromDate,
                                    @Param("toDate") LocalDate toDate,
                                    @Param("statuses") List<Status> statuses,
                                    @Param("ignoreEventId") Long ignoreEventId);

  @Query("""
      select e from Event e
      where e.active = true
        and e.date = :date
        and e.requiresTech = true
        and e.status in :statuses
        and (:ignoreEventId is null or e.id <> :ignoreEventId)
      """)
  List<Event> findTechEventsForDate(@Param("date") LocalDate date,
      @Param("statuses") List<Status> statuses,
      @Param("ignoreEventId") Long ignoreEventId);
}
