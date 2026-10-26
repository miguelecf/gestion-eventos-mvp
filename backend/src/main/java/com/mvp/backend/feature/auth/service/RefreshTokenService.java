package com.mvp.backend.feature.auth.service;

import com.mvp.backend.feature.auth.model.RefreshToken;
import com.mvp.backend.feature.auth.repository.RefreshTokenRepository;
import com.mvp.backend.feature.users.model.User;
import jakarta.transaction.Transactional;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;
import org.springframework.web.server.ResponseStatusException;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository repository;

    @Value("${jwt.refresh-token.expiration}")
    private long refreshTokenExpirationMs;

    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public GeneratedRefreshToken create(User user, RefreshToken rotatedFrom) {
        Assert.notNull(user, "user no puede ser nulo");
        String plainToken = generateToken();
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(hashToken(plainToken));
        refreshToken.setExpiresAt(Instant.now().plusMillis(refreshTokenExpirationMs));
        refreshToken.setRotatedFrom(rotatedFrom);
        RefreshToken saved = repository.save(refreshToken);
        return new GeneratedRefreshToken(plainToken, saved);
    }

    // Sin rollback por el 401/403: la revocación defensiva y la del token vencido deben persistir.
    @Transactional(dontRollbackOn = ResponseStatusException.class)
    public RefreshToken validate(String token) {
        if (!org.springframework.util.StringUtils.hasText(token)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Refresh token inválido");
        }
        String hashed = hashToken(token);
        RefreshToken refreshToken = repository.findByTokenHash(hashed)
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Refresh token inválido"));

        if (refreshToken.isRevoked()) {
            repository.revokeAllActiveForUser(refreshToken.getUser(), Instant.now());
            throw new ResponseStatusException(FORBIDDEN, "Refresh token revocado");
        }

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshToken.setRevoked(true);
            repository.save(refreshToken);
            throw new ResponseStatusException(UNAUTHORIZED, "Refresh token expirado");
        }

        return refreshToken;
    }

    @Transactional
    public void revoke(RefreshToken token) {
        if (token == null || token.isRevoked()) {
            return;
        }
        token.setRevoked(true);
        repository.save(token);
    }

    @Transactional
    public void revokeAll(User user) {
        repository.revokeAllActiveForUser(user, Instant.now());
    }

    private String generateToken() {
        byte[] bytes = new byte[64];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes());
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("No se pudo hashear el token", e);
        }
    }

    @Getter
    public static class GeneratedRefreshToken {
        private final String plainToken;
        private final RefreshToken entity;

        public GeneratedRefreshToken(String plainToken, RefreshToken entity) {
            this.plainToken = plainToken;
            this.entity = entity;
        }
    }
}