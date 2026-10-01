package com.mvp.backend.feature.events.model;

public enum Status {
    // Las altas manuales y las conversiones de solicitudes nacen en EN_REVISION.
    // El pedido público tiene su propio ciclo (RequestStatus.RECIBIDO); SOLICITADO se eliminó (hallazgo 3.3).
    EN_REVISION, RESERVADO, APROBADO, RECHAZADO
}
