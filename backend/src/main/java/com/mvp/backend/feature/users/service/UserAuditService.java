package com.mvp.backend.feature.users.service;

import com.mvp.backend.feature.users.dto.UserAuditEntryResponse;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.users.model.UserAuditAction;
import com.mvp.backend.feature.users.model.UserAuditEntry;
import com.mvp.backend.feature.users.repository.UserAuditRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Historial de las acciones administrativas sobre cuentas internas (REV-09, CU-02). El actor es
 * siempre el usuario autenticado que ejecuta la acción; nunca se registran contraseñas.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserAuditService {

    private final UserAuditRepository repository;

    public void record(User target, User actor, UserAuditAction action, String details) {
        repository.save(UserAuditEntry.builder()
                .target(target)
                .actor(actor)
                .at(Instant.now())
                .action(action)
                .details(details)
                .build());
    }

    @Transactional(readOnly = true)
    public List<UserAuditEntryResponse> history(Long targetUserId) {
        return repository.findByTargetIdOrderByAtDescIdDesc(targetUserId).stream()
                .map(entry -> new UserAuditEntryResponse(
                        entry.getId(),
                        entry.getAction(),
                        entry.getDetails(),
                        entry.getActor() != null ? entry.getActor().getUsername() : null,
                        entry.getAt()))
                .toList();
    }
}
