package com.mvp.backend.feature.requests.repository;

import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.feature.requests.model.RequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventRequestRepository extends JpaRepository<EventRequest, Long> {
    Optional<EventRequest> findByTrackingUuid(String trackingUuid);

    Optional<EventRequest> findByConvertedEvent_Id(Long eventId);

    boolean existsByTrackingUuid(String trackingUuid);

    List<EventRequest> findByActiveTrue();

    List<EventRequest> findByActiveTrueOrderByRequestDateDesc();

    List<EventRequest> findByActiveTrueAndStatusInOrderByRequestDateDesc(List<RequestStatus> statuses);

    List<EventRequest> findByActiveTrueAndStatusIn(List<RequestStatus> statuses);

    Page<EventRequest> findByActiveTrueAndStatusIn(List<RequestStatus> statuses, Pageable pageable);
}
