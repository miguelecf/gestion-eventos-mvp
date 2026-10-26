package com.mvp.backend.feature.requests.repository;

import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.feature.requests.model.RequestStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EventRequestRepository extends JpaRepository<EventRequest, Long> {
    Optional<EventRequest> findByTrackingUuid(String trackingUuid);

    Optional<EventRequest> findByConvertedEvent_Id(Long eventId);

    boolean existsByTrackingUuid(String trackingUuid);

    /**
     * Solicitud con bloqueo de fila hasta el fin de la transacción: serializa las transiciones de
     * estado y la conversión, para que dos operaciones simultáneas no partan del mismo estado (REV-06).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from EventRequest r where r.id = :id")
    Optional<EventRequest> findByIdForUpdate(@Param("id") Long id);

    List<EventRequest> findByActiveTrueOrderByRequestDateDesc();

    List<EventRequest> findByActiveTrueAndStatusInOrderByRequestDateDesc(List<RequestStatus> statuses);

}
