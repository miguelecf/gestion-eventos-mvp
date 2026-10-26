package com.mvp.backend.feature.auth;

import com.mvp.backend.support.IntegrationTestBase;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** REV-10: un token vencido, mal firmado o de alcance limitado no da acceso a la API interna. */
class JwtAuthenticationIntegrationTest extends IntegrationTestBase {

    @Value("${jwt.secret}")
    private String secret;

    private String token(String signingSecret, Instant expiry, String role, Set<String> scopes) {
        Long id = user(Role.ADMIN_FULL).getId();
        return Jwts.builder()
                .setSubject(String.valueOf(id))
                .claim("role", role)
                .claim("scopes", scopes)
                .setIssuedAt(Date.from(expiry.minusSeconds(600)))
                .setExpiration(Date.from(expiry))
                .signWith(Keys.hmacShaKeyFor(signingSecret.getBytes(StandardCharsets.UTF_8)), SignatureAlgorithm.HS256)
                .compact();
    }

    @Test
    void tokenValidoAccede() throws Exception {
        String valid = token(secret, Instant.now().plusSeconds(600), "ADMIN_FULL", Set.of());
        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, "Bearer " + valid))
                .andExpect(status().isOk());
    }

    @Test
    void tokenVencidoResponde401() throws Exception {
        String expired = token(secret, Instant.now().minusSeconds(60), "ADMIN_FULL", Set.of());
        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, "Bearer " + expired))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenFirmadoConOtraClaveResponde401() throws Exception {
        String forged = token("otra-clave-de-al-menos-treinta-y-dos-bytes!!", Instant.now().plusSeconds(600), "ADMIN_FULL", Set.of());
        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, "Bearer " + forged))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, "Bearer no-es-un-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenDeCambioDeContrasenaNoOperaLaApi() throws Exception {
        // El login con mustChangePassword entrega un token que solo sirve para cambiar la contraseña.
        String limited = token(secret, Instant.now().plusSeconds(600), "ADMIN_FULL", Set.of("password:update"));
        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, "Bearer " + limited))
                .andExpect(status().isForbidden());
    }

    @Test
    void refreshConTokenInvalidoResponde401() throws Exception {
        mockMvc.perform(json(post("/auth/refresh"), Map.of("refreshToken", "no-existe")))
                .andExpect(status().isUnauthorized());
    }
}
