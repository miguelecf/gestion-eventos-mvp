package com.mvp.backend.feature.users.service;

import com.mvp.backend.feature.auth.security.CurrentUserService;
import com.mvp.backend.feature.auth.service.EmailService;
import com.mvp.backend.feature.users.dto.CreateUserRequest;
import com.mvp.backend.feature.users.dto.UpdateUserRequest;
import com.mvp.backend.feature.users.dto.UpdateUserRoleRequest;
import com.mvp.backend.feature.users.dto.UpdateUserStatusRequest;
import com.mvp.backend.feature.users.dto.UserAuditEntryResponse;
import com.mvp.backend.feature.users.dto.UserAdminResponse;
import com.mvp.backend.feature.users.dto.UserRoleOptionResponse;
import com.mvp.backend.feature.users.model.RoleName;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.users.model.UserAuditAction;
import com.mvp.backend.feature.users.repository.UserRepository;
import com.mvp.backend.shared.Priority;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
@Transactional
public class UserAdminService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String TEMP_PASSWORD_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final CurrentUserService currentUserService;
    private final UserAuditService userAuditService;

    @Transactional(readOnly = true)
    public Page<UserAdminResponse> list(String q, Boolean active, String role, Pageable pageable) {
        String query = q != null ? q.trim() : "";
        String normalizedRole = normalizeRoleFilter(role);

        Specification<User> specification = Specification.where(null);

        if (!query.isEmpty()) {
            String like = "%" + query.toLowerCase(Locale.ROOT) + "%";
            specification = specification.and((root, ignored, cb) ->
                    cb.or(
                            cb.like(cb.lower(root.get("username")), like),
                            cb.like(cb.lower(root.get("email")), like),
                            cb.like(cb.lower(root.get("name")), like),
                            cb.like(cb.lower(root.get("lastName")), like)
                    ));
        }

        if (active != null) {
            specification = specification.and((root, ignored, cb) -> cb.equal(root.get("active"), active));
        }

        if (normalizedRole != null) {
            specification = specification.and((root, ignored, cb) -> cb.equal(root.get("role"), normalizedRole));
        }

        return userRepository.findAll(specification, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public UserAdminResponse getById(Long id) {
        return toResponse(findUser(id));
    }

    @Transactional(readOnly = true)
    public List<UserAuditEntryResponse> history(Long id) {
        findUser(id);
        return userAuditService.history(id);
    }

    public UserAdminResponse create(CreateUserRequest request) {
        String username = normalizeRequired(request.username(), "username");
        String email = normalizeRequired(request.email(), "email");
        String name = normalizeRequired(request.name(), "name");
        String lastName = normalizeRequired(request.lastName(), "lastName");

        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new ResponseStatusException(CONFLICT, "El nombre de usuario ya está en uso");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(CONFLICT, "El email ya está en uso");
        }

        RoleName role = RoleName.fromNullable(request.role(), RoleName.USUARIO);
        Priority priority = request.priority() != null ? request.priority() : Priority.LOW;

        String temporaryPassword = generateTemporaryPassword();

        User user = User.builder()
                .username(username)
                .email(email)
                .name(name)
                .lastName(lastName)
                .password(passwordEncoder.encode(temporaryPassword))
                .priority(priority)
                .role(role.name())
                .mustChangePassword(true)
                .failedLoginAttempts(0)
                .build();
        user.setActive(request.active() == null || request.active());

        User saved = userRepository.save(user);
        userAuditService.record(saved, currentUserService.get(), UserAuditAction.CREATED,
                "rol " + saved.getRole() + (saved.isActive() ? ", activo" : ", inactivo"));
        emailService.sendNewPassword(saved.getEmail(), temporaryPassword);

        return toResponse(saved);
    }

    public UserAdminResponse update(Long id, UpdateUserRequest request) {
        User user = findUser(id);
        List<String> changed = new ArrayList<>();

        if (request.username() != null) {
            String username = normalizeRequired(request.username(), "username");
            if (!username.equalsIgnoreCase(user.getUsername()) &&
                    userRepository.existsByUsernameIgnoreCaseAndIdNot(username, id)) {
                throw new ResponseStatusException(CONFLICT, "El nombre de usuario ya está en uso");
            }
            if (!username.equals(user.getUsername())) {
                changed.add("username");
            }
            user.setUsername(username);
        }

        if (request.email() != null) {
            String email = normalizeRequired(request.email(), "email");
            if (!email.equalsIgnoreCase(user.getEmail()) &&
                    userRepository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
                throw new ResponseStatusException(CONFLICT, "El email ya está en uso");
            }
            if (!email.equals(user.getEmail())) {
                changed.add("email");
            }
            user.setEmail(email);
        }

        if (request.name() != null) {
            String name = normalizeRequired(request.name(), "name");
            if (!name.equals(user.getName())) {
                changed.add("name");
            }
            user.setName(name);
        }

        if (request.lastName() != null) {
            String lastName = normalizeRequired(request.lastName(), "lastName");
            if (!lastName.equals(user.getLastName())) {
                changed.add("lastName");
            }
            user.setLastName(lastName);
        }

        if (request.priority() != null) {
            if (request.priority() != user.getPriority()) {
                changed.add("priority");
            }
            user.setPriority(request.priority());
        }

        User saved = userRepository.save(user);
        if (!changed.isEmpty()) {
            userAuditService.record(saved, currentUserService.get(), UserAuditAction.UPDATED,
                    "campos: " + String.join(", ", changed));
        }
        return toResponse(saved);
    }

    public UserAdminResponse updateRole(Long id, UpdateUserRoleRequest request) {
        User target = findUser(id);
        User actor = currentUserService.get();

        RoleName nextRole = RoleName.fromValue(request.role());
        String currentRole = target.getRole();

        if (actor.getId().equals(target.getId()) && nextRole != RoleName.ADMIN_FULL) {
            throw new ResponseStatusException(BAD_REQUEST, "No podés quitarte el rol ADMIN_FULL");
        }

        if ("ADMIN_FULL".equals(currentRole) && nextRole != RoleName.ADMIN_FULL &&
                target.isActive() && userRepository.countByRoleAndActiveTrue(RoleName.ADMIN_FULL.name()) <= 1) {
            throw new ResponseStatusException(CONFLICT, "Debe existir al menos un ADMIN_FULL activo");
        }

        target.setRole(nextRole.name());
        User saved = userRepository.save(target);
        if (!nextRole.name().equals(currentRole)) {
            userAuditService.record(saved, actor, UserAuditAction.ROLE_CHANGED, currentRole + " → " + nextRole.name());
        }
        return toResponse(saved);
    }

    public UserAdminResponse updateStatus(Long id, UpdateUserStatusRequest request) {
        User target = findUser(id);
        User actor = currentUserService.get();
        boolean nextActive = request.active();

        if (actor.getId().equals(target.getId()) && !nextActive) {
            throw new ResponseStatusException(BAD_REQUEST, "No podés desactivarte a vos mismo");
        }

        if ("ADMIN_FULL".equals(target.getRole()) && target.isActive() && !nextActive &&
                userRepository.countByRoleAndActiveTrue(RoleName.ADMIN_FULL.name()) <= 1) {
            throw new ResponseStatusException(CONFLICT, "Debe existir al menos un ADMIN_FULL activo");
        }

        boolean wasActive = target.isActive();
        target.setActive(nextActive);
        User saved = userRepository.save(target);
        if (wasActive != nextActive) {
            userAuditService.record(saved, actor, UserAuditAction.STATUS_CHANGED, nextActive ? "activado" : "desactivado");
        }
        return toResponse(saved);
    }

    public UserAdminResponse resetPassword(Long id) {
        User user = findUser(id);
        String temporaryPassword = generateTemporaryPassword();

        user.setPassword(passwordEncoder.encode(temporaryPassword));
        user.setMustChangePassword(true);
        user.setFailedLoginAttempts(0);

        User saved = userRepository.save(user);
        userAuditService.record(saved, currentUserService.get(), UserAuditAction.PASSWORD_RESET,
                "contraseña temporal enviada por correo");
        emailService.sendNewPassword(saved.getEmail(), temporaryPassword);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public java.util.List<UserRoleOptionResponse> listRoles() {
        return Arrays.stream(RoleName.values())
                .map(role -> new UserRoleOptionResponse(role.name(), roleLabel(role)))
                .toList();
    }

    private String roleLabel(RoleName role) {
        return switch (role) {
            case ADMIN_FULL -> "Administrador General";
            case ADMIN_CEREMONIAL -> "Administrador Ceremonial";
            case ADMIN_TECNICA -> "Administrador Técnica";
            case USUARIO -> "Usuario";
        };
    }

    private String normalizeRoleFilter(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        return RoleName.fromValue(role).name();
    }

    private String normalizeRequired(String value, String fieldName) {
        String normalized = value != null ? value.trim() : "";
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, fieldName + " no puede estar vacío");
        }
        return normalized;
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Usuario no encontrado"));
    }

    private String generateTemporaryPassword() {
        int length = 12 + RANDOM.nextInt(5); // 12-16
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            builder.append(TEMP_PASSWORD_CHARS.charAt(RANDOM.nextInt(TEMP_PASSWORD_CHARS.length())));
        }
        return builder.toString();
    }

    private UserAdminResponse toResponse(User user) {
        return new UserAdminResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getName(),
                user.getLastName(),
                user.getPriority(),
                user.getRole(),
                user.isActive(),
                user.isMustChangePassword(),
                user.getFailedLoginAttempts(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
