package com.mvp.backend.security;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hallazgo 1.4: USUARIO sólo consulta eventos y crea solicitudes; no crea, edita ni da de baja eventos.
 * Contrato en docs/permisos.md.
 */
class UsuarioPermissionsIntegrationTest extends IntegrationTestBase {

    @Test
    void usuarioNoEscribeEventos() throws Exception {
        Event event = newEvent(Status.EN_REVISION);

        mockMvc.perform(as(Role.USUARIO, json(post("/api/events"), Map.of("name", "x"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(Role.USUARIO, json(patch("/api/events/{id}", event.getId()), Map.of("name", "Hackeado"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(Role.USUARIO, patch("/api/events/{id}/soft-delete", event.getId())))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(Role.USUARIO, json(post("/api/events/{id}/status", event.getId()), Map.of("to", "RESERVADO"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(Role.USUARIO, get("/api/events/{id}/comments", event.getId())))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(Role.USUARIO, get("/api/audit/{id}", event.getId())))
                .andExpect(status().isForbidden());
    }

    @Test
    void usuarioLeeEventosYCatalogosYCreaSolicitudes() throws Exception {
        Event event = newEvent(Status.EN_REVISION);

        mockMvc.perform(as(Role.USUARIO, get("/api/events"))).andExpect(status().isOk());
        mockMvc.perform(as(Role.USUARIO, get("/api/events/{id}", event.getId()))).andExpect(status().isOk());
        mockMvc.perform(as(Role.USUARIO, get("/api/catalogs/spaces"))).andExpect(status().isOk());
        mockMvc.perform(as(Role.USUARIO, json(post("/api/catalogs/spaces"), Map.of("name", "x"))))
                .andExpect(status().isForbidden());
        createPublicRequest();
    }

    @Test
    void adminsEditanEventos() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        mockMvc.perform(as(Role.ADMIN_TECNICA, json(patch("/api/events/{id}", event.getId()), Map.of("name", "Renombrado"))))
                .andExpect(status().isOk());
    }
}
