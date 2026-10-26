package com.mvp.backend.feature.users.dto;

import com.mvp.backend.feature.users.model.UserAuditAction;

import java.time.Instant;

public record UserAuditEntryResponse(
        Long id,
        UserAuditAction action,
        String details,
        String actorUsername,
        Instant at
) {
}
