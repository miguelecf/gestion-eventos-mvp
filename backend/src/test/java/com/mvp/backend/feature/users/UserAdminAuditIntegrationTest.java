package com.mvp.backend.feature.users;

import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** REV-09 (CU-02, RNF-05): cada acción administrativa sobre una cuenta queda registrada con su actor. */
class UserAdminAuditIntegrationTest extends IntegrationTestBase {

    @Test
    void lasAccionesSobreUnaCuentaQuedanEnSuHistorialConElActor() throws Exception {
        String username = "audit." + UUID.randomUUID().toString().substring(0, 8);
        String created = mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/users"), Map.of(
                        "username", username,
                        "email", username + "@test.local",
                        "name", "Cuenta",
                        "lastName", "Auditada"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = objectMapper.readTree(created).get("id").asLong();

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}", id), Map.of("name", "Cuenta editada"))))
                .andExpect(status().isOk());
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}/role", id), Map.of("role", "ADMIN_TECNICA"))))
                .andExpect(status().isOk());
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}/status", id), Map.of("active", false))))
                .andExpect(status().isOk());
        mockMvc.perform(as(Role.ADMIN_FULL, post("/api/users/{id}/reset-password", id)))
                .andExpect(status().isOk());
        // Un rol igual al actual no es un cambio y no se registra.
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}/role", id), Map.of("role", "ADMIN_TECNICA"))))
                .andExpect(status().isOk());

        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/users/{id}/history", id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].action").value(contains(
                        "PASSWORD_RESET", "STATUS_CHANGED", "ROLE_CHANGED", "UPDATED", "CREATED")))
                .andExpect(jsonPath("$[*].actorUsername").value(everyItem(org.hamcrest.Matchers.is(user(Role.ADMIN_FULL).getUsername()))))
                .andExpect(jsonPath("$[?(@.action == 'ROLE_CHANGED')].details").value(contains("USUARIO → ADMIN_TECNICA")))
                .andExpect(jsonPath("$[?(@.action == 'UPDATED')].details").value(contains("campos: name")));
    }

    @Test
    void elHistorialEsSoloParaAdminFull() throws Exception {
        long id = user(Role.USUARIO).getId();
        for (Role role : new Role[]{Role.USUARIO, Role.ADMIN_CEREMONIAL, Role.ADMIN_TECNICA}) {
            mockMvc.perform(as(role, get("/api/users/{id}/history", id))).andExpect(status().isForbidden());
        }
        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/users/{id}/history", 999_999L))).andExpect(status().isNotFound());
    }

    @Test
    void elHistorialNoGuardaContrasenas() throws Exception {
        // Cuenta propia: resetear la de un rol compartido rompería el login de los demás tests.
        String username = "reset." + UUID.randomUUID().toString().substring(0, 8);
        long id = userRepository.save(com.mvp.backend.feature.users.model.User.builder()
                .username(username)
                .name("Cuenta")
                .lastName("Reset")
                .email(username + "@test.local")
                .password(passwordEncoder.encode(PASSWORD))
                .priority(com.mvp.backend.shared.Priority.MEDIUM)
                .role("USUARIO")
                .mustChangePassword(false)
                .build()).getId();
        mockMvc.perform(as(Role.ADMIN_FULL, post("/api/users/{id}/reset-password", id))).andExpect(status().isOk());

        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/users/{id}/history", id)))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].details").value(not(containsString(PASSWORD))));
    }
}
