package com.mvp.backend.feature.auth;

import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.shared.Priority;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 2.7: cambio de contraseña propio y flujo de contraseña temporal. */
class ChangePasswordIntegrationTest extends IntegrationTestBase {

    private static final String NEW_PASSWORD = "NuevaClave2026";

    private User newUser(boolean mustChangePassword) {
        String username = "pwd." + UUID.randomUUID().toString().substring(0, 8);
        return userRepository.save(User.builder()
                .username(username).name("Pwd").lastName("Test").email(username + "@test.local")
                .password(passwordEncoder.encode(PASSWORD))
                .priority(Priority.LOW).role("USUARIO")
                .mustChangePassword(mustChangePassword)
                .build());
    }

    private String login(String username, String password) throws Exception {
        String res = mockMvc.perform(json(post("/auth/login"), Map.of("username", username, "password", password)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(res).get("accessToken").asText();
    }

    @Test
    void exigeContrasenaActual() throws Exception {
        User u = newUser(false);
        String token = login(u.getUsername(), PASSWORD);
        mockMvc.perform(json(post("/auth/change-password"), Map.of("newPassword", NEW_PASSWORD))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rechazaContrasenaActualIncorrecta() throws Exception {
        User u = newUser(false);
        String token = login(u.getUsername(), PASSWORD);
        mockMvc.perform(json(post("/auth/change-password"),
                        Map.of("currentPassword", "otraCosa123", "newPassword", NEW_PASSWORD))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cambiaContrasenaYPermiteLoginConLaNueva() throws Exception {
        User u = newUser(false);
        String token = login(u.getUsername(), PASSWORD);
        mockMvc.perform(json(post("/auth/change-password"),
                        Map.of("currentPassword", PASSWORD, "newPassword", NEW_PASSWORD))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNoContent());
        login(u.getUsername(), NEW_PASSWORD);
    }

    @Test
    void contrasenaTemporalSoloPermiteCambiarla() throws Exception {
        User u = newUser(true);
        String res = mockMvc.perform(json(post("/auth/login"), Map.of("username", u.getUsername(), "password", PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(true))
                .andReturn().getResponse().getContentAsString();
        String limitedToken = objectMapper.readTree(res).get("accessToken").asText();

        mockMvc.perform(get("/api/events").header(HttpHeaders.AUTHORIZATION, "Bearer " + limitedToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(json(post("/auth/change-password"),
                        Map.of("currentPassword", PASSWORD, "newPassword", NEW_PASSWORD))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + limitedToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(json(post("/auth/login"), Map.of("username", u.getUsername(), "password", NEW_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").doesNotExist())
                .andExpect(jsonPath("$.refreshToken").exists());
    }
}
