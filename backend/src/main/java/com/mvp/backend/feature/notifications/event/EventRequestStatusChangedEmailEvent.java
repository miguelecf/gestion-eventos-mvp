package com.mvp.backend.feature.notifications.event;

import com.mvp.backend.feature.requests.model.RequestStatus;

/** Cambio de estado de una solicitud pública que se notifica al solicitante (hallazgo 2.5). */
public record EventRequestStatusChangedEmailEvent(Long eventRequestId, RequestStatus newStatus, String reason) {
}
