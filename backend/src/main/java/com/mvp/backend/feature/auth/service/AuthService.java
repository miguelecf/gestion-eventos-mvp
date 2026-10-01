package com.mvp.backend.feature.auth.service;

import com.mvp.backend.feature.auth.dto.*;
import com.mvp.backend.feature.auth.model.RefreshToken;
import com.mvp.backend.feature.auth.security.JwtTokenProvider;
import com.mvp.backend.feature.auth.security.UserPrincipal;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.users.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Collections;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final UserService userService;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;
    private final EmailService emailService;

    private static final String TOKEN_TYPE = "Bearer";
    private static final SecureRandom RANDOM = new SecureRandom();

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        String temporaryPassword = generateTemporaryPassword();
        String encoded = passwordEncoder.encode(temporaryPassword);
        User user = userService.register(request, encoded);
        emailService.sendNewPassword(user.getEmail(), temporaryPassword);
        return RegisterResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                    request.getUsername(), request.getPassword()
            ));
        } catch (LockedException ex) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Usuario bloqueado o pendiente");
        } catch (BadCredentialsException ex) {
            userService.findByUsername(request.getUsername()).ifPresent(user -> {
                user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
                userService.save(user);
            });
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }

        SecurityContextHolder.getContext().setAuthentication(authentication);

        User user = userService.getByUsername(request.getUsername());

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Usuario bloqueado o pendiente");
        }

        user.setFailedLoginAttempts(0);
        user.setLastLoginAt(Instant.now());
        userService.save(user);

        if (user.isMustChangePassword()) {
            String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getUsername(), null,
                    Set.of("password:update"));
            return LoginResponse.builder()
                    .accessToken(accessToken)
                    .tokenType(TOKEN_TYPE)
                    .expiresIn(jwtTokenProvider.getAccessTokenExpirationMs() / 1000)
                    .mustChangePassword(true)
                    .build();
        }

        RefreshTokenService.GeneratedRefreshToken refresh = refreshTokenService.create(user, null);
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getUsername(), user.getRole(), Collections.emptySet());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refresh.getPlainToken())
                .tokenType(TOKEN_TYPE)
                .expiresIn(jwtTokenProvider.getAccessTokenExpirationMs() / 1000)
                .user(UserSummary.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .role(user.getRole())
                        .build())
                .build();
    }

    @Transactional(readOnly = false)
    public void changePassword(ChangePasswordRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No autenticado");
        }
        User user = userService.getById(principal.getId());

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            // 400 y no 401: un 401 lo interpreta el cliente como sesión vencida (refresh/logout).
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La contraseña actual no es válida");
        }

        String hash = passwordEncoder.encode(request.getNewPassword());
        int updated = userService.updatePassword(user.getId(), hash);
        if (updated != 1) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo actualizar la contraseña");
        }

        refreshTokenService.revokeAll(user);
    }

    @Transactional
    public LoginResponse refresh(RefreshRequest request) {
        RefreshToken existing = refreshTokenService.validate(request.getRefreshToken());
        User user = existing.getUser();
        if (user.isMustChangePassword()) {
            refreshTokenService.revoke(existing);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Debe cambiar la contraseña");
        }
        refreshTokenService.revoke(existing);
        RefreshTokenService.GeneratedRefreshToken rotated = refreshTokenService.create(user, existing);
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getUsername(), user.getRole(), Collections.emptySet());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rotated.getPlainToken())
                .tokenType(TOKEN_TYPE)
                .expiresIn(jwtTokenProvider.getAccessTokenExpirationMs() / 1000)
                .user(UserSummary.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .role(user.getRole())
                        .build())
                .build();
    }

    @Transactional
    public void logout(RefreshRequest request) {
        if (request == null || !StringUtils.hasText(request.getRefreshToken())) {
            return;
        }
        try {
            RefreshToken existing = refreshTokenService.validate(request.getRefreshToken());
            refreshTokenService.revoke(existing);
        } catch (ResponseStatusException ex) {
            // Ignora tokens inválidos al cerrar sesión
        }
    }

    public UserSummary currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No autenticado");
        }
        User user = userService.getById(principal.getId());
        return UserSummary.builder()
                .id(user.getId())
                .username(user.getUsername())
                .role(user.getRole())
                .build();
    }

    private String generateTemporaryPassword() {
        int length = 12 + RANDOM.nextInt(5); // 12-16
        final String characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            builder.append(characters.charAt(RANDOM.nextInt(characters.length())));
        }
        return builder.toString();
    }
}