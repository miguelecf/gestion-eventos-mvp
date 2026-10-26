package com.mvp.backend.feature.users;

import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** REV-10 (RF-02, CU-02): reglas de la administración de cuentas internas. */
class UserManagementIntegrationTest extends IntegrationTestBase {

    private Map<String, Object> newUser(String username) {
        return Map.of("username", username, "email", username + "@test.local", "name", "Cuenta", "lastName", "Nueva");
    }

    @Test
    void altaConContrasenaTemporalYUsernameUnico() throws Exception {
        String username = "alta." + UUID.randomUUID().toString().substring(0, 8);

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/users"), newUser(username))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("USUARIO"))
                .andExpect(jsonPath("$.password").doesNotExist());
        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/users"), newUser(username))))
                .andExpect(status().isConflict());
    }

    @Test
    void elAdministradorNoSeQuitaElRolNiSeDesactiva() throws Exception {
        long self = user(Role.ADMIN_FULL).getId();

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}/role", self), Map.of("role", "USUARIO"))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}/status", self), Map.of("active", false))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unaCuentaDesactivadaNoIniciaSesion() throws Exception {
        String username = "baja." + UUID.randomUUID().toString().substring(0, 8);
        long id = objectMapper.readTree(mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/users"), newUser(username))))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        var user = userRepository.findById(id).orElseThrow();
        user.setPassword(passwordEncoder.encode(PASSWORD));
        user.setMustChangePassword(false);
        userRepository.save(user);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}/status", id), Map.of("active", false))))
                .andExpect(status().isOk());

        mockMvc.perform(json(post("/auth/login"), Map.of("username", username, "password", PASSWORD)))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void soloAdminFullAdministraCuentas() throws Exception {
        for (Role role : new Role[]{Role.USUARIO, Role.ADMIN_CEREMONIAL, Role.ADMIN_TECNICA}) {
            mockMvc.perform(as(role, json(post("/api/users"), newUser("no." + UUID.randomUUID().toString().substring(0, 8)))))
                    .andExpect(status().isForbidden());
        }
    }
}
