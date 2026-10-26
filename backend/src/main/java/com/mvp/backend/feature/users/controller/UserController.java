package com.mvp.backend.feature.users.controller;

import com.mvp.backend.feature.users.dto.CreateUserRequest;
import com.mvp.backend.feature.users.dto.UpdateUserRequest;
import com.mvp.backend.feature.users.dto.UpdateUserRoleRequest;
import com.mvp.backend.feature.users.dto.UpdateUserStatusRequest;
import com.mvp.backend.feature.users.dto.UserAdminResponse;
import com.mvp.backend.feature.users.dto.UserAuditEntryResponse;
import com.mvp.backend.feature.users.dto.UserRoleOptionResponse;
import com.mvp.backend.feature.users.service.UserAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN_FULL')")
public class UserController {

    private final UserAdminService service;

    @GetMapping
    public Page<UserAdminResponse> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String role,
            @PageableDefault(size = 20, sort = "username", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        return service.list(q, active, role, pageable);
    }

    @GetMapping("/{id}")
    public UserAdminResponse getById(@PathVariable Long id) {
        return service.getById(id);
    }

    /** Historial de acciones administrativas sobre la cuenta, del más reciente al más antiguo. */
    @GetMapping("/{id}/history")
    public List<UserAuditEntryResponse> history(@PathVariable Long id) {
        return service.history(id);
    }

    @PostMapping
    public ResponseEntity<UserAdminResponse> create(@Valid @RequestBody CreateUserRequest request) {
        UserAdminResponse created = service.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{id}")
    public UserAdminResponse update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request
    ) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/role")
    public UserAdminResponse updateRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRoleRequest request
    ) {
        return service.updateRole(id, request);
    }

    @PatchMapping("/{id}/status")
    public UserAdminResponse updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserStatusRequest request
    ) {
        return service.updateStatus(id, request);
    }

    @PostMapping("/{id}/reset-password")
    public UserAdminResponse resetPassword(@PathVariable Long id) {
        return service.resetPassword(id);
    }

    @GetMapping("/roles")
    public List<UserRoleOptionResponse> listRoles() {
        return service.listRoles();
    }
}
