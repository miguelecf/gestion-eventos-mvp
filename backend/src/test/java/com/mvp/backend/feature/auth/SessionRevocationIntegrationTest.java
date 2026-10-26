package com.mvp.backend.feature.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.shared.Priority;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REV-12: los permisos salen del rol vigente en la base y no del token, y un restablecimiento o
 * una reutilización de refresh token cortan las sesiones anteriores.
 */
class SessionRevocationIntegrationTest extends IntegrationTestBase {

    private User account(String role) {
        String username = "sesion." + UUID.randomUUID().toString().substring(0, 8);
        return userRepository.save(User.builder()
                .username(username)
                .name("Cuenta")
                .lastName("Sesion")
                .email(username + "@test.local")
                .password(passwordEncoder.encode(PASSWORD))
                .priority(Priority.MEDIUM)
                .role(role)
                .mustChangePassword(false)
                .build());
    }

    private JsonNode login(User user) throws Exception {
        String res = mockMvc.perform(json(post("/auth/login"), Map.of("username", user.getUsername(), "password", PASSWORD)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(res);
    }

    private static String bearer(JsonNode session) {
        return "Bearer " + session.get("accessToken").asText();
    }

    @Test
    void unAdministradorDegradadoPierdeLosPermisosConSuTokenAnterior() throws Exception {
        User admin = account("ADMIN_FULL");
        JsonNode session = login(admin);
        mockMvc.perform(get("/api/users").header(HttpHeaders.AUTHORIZATION, bearer(session))).andExpect(status().isOk());

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}/role", admin.getId()), Map.of("role", "USUARIO"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/users").header(HttpHeaders.AUTHORIZATION, bearer(session))).andExpect(status().isForbidden());
        // Tampoco puede devolverse el rol con el token viejo.
        mockMvc.perform(json(patch("/api/users/{id}/role", admin.getId()), Map.of("role", "ADMIN_FULL"))
                        .header(HttpHeaders.AUTHORIZATION, bearer(session)))
                .andExpect(status().isForbidden());
    }

    @Test
    void elRestablecimientoCortaLasSesionesAnteriores() throws Exception {
        User account = account("ADMIN_CEREMONIAL");
        JsonNode session = login(account);
        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, bearer(session))).andExpect(status().isOk());

        mockMvc.perform(as(Role.ADMIN_FULL, post("/api/users/{id}/reset-password", account.getId()))).andExpect(status().isOk());

        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, bearer(session))).andExpect(status().isUnauthorized());
        mockMvc.perform(json(post("/auth/refresh"), Map.of("refreshToken", session.get("refreshToken").asText())))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void reutilizarUnRefreshTokenRotadoRevocaTambienElNuevo() throws Exception {
        JsonNode first = login(account("ADMIN_TECNICA"));
        String r1 = first.get("refreshToken").asText();

        String res = mockMvc.perform(json(post("/auth/refresh"), Map.of("refreshToken", r1)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String r2 = objectMapper.readTree(res).get("refreshToken").asText();

        mockMvc.perform(json(post("/auth/refresh"), Map.of("refreshToken", r1))).andExpect(status().isForbidden());
        mockMvc.perform(json(post("/auth/refresh"), Map.of("refreshToken", r2))).andExpect(status().isForbidden());
    }

    @Test
    void unaCuentaDesactivadaNoRenuevaSuSesion() throws Exception {
        User account = account("ADMIN_TECNICA");
        JsonNode session = login(account);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}/status", account.getId()), Map.of("active", false))))
                .andExpect(status().isOk());

        mockMvc.perform(json(post("/auth/refresh"), Map.of("refreshToken", session.get("refreshToken").asText())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void elTokenAnteriorAlRestablecimientoNoRevivaAlCambiarLaContrasena() throws Exception {
        User account = account("ADMIN_CEREMONIAL");
        JsonNode session = login(account);
        // El token viejo y el reset no deben caer en el mismo segundo: el iat tiene precisión de segundos.
        Thread.sleep(1100);

        mockMvc.perform(as(Role.ADMIN_FULL, post("/api/users/{id}/reset-password", account.getId()))).andExpect(status().isOk());
        // El titular define su contraseña: mustChangePassword vuelve a false.
        User reset = userRepository.findById(account.getId()).orElseThrow();
        reset.setPassword(passwordEncoder.encode(PASSWORD));
        reset.setMustChangePassword(false);
        userRepository.save(reset);

        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, bearer(session))).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, bearer(login(account)))).andExpect(status().isOk());
    }
}
