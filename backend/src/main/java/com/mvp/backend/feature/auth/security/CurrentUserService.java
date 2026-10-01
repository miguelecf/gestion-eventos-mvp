package com.mvp.backend.feature.auth.security;

import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.users.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Resuelve el usuario autenticado de la request actual.
 * Usar en lugar de recibir IDs de actor desde el cliente: quien ejecuta una acción
 * auditable es siempre el principal autenticado.
 */
@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final UserService userService;

    public User get() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user");
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userService.getById(userPrincipal.getId());
        }
        if (principal instanceof UserDetails details) {
            return userService.getByUsername(details.getUsername());
        }
        if (principal instanceof String username && !"anonymousUser".equals(username)) {
            return userService.getByUsername(username);
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user");
    }
}
