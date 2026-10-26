package com.mvp.backend.feature.users.model;

/** Acciones administrativas sobre una cuenta interna que quedan registradas (REV-09). */
public enum UserAuditAction {
    CREATED,
    UPDATED,
    ROLE_CHANGED,
    STATUS_CHANGED,
    PASSWORD_RESET
}
