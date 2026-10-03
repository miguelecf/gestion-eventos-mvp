package com.mvp.backend.feature.priority;

import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 1.6: consulta y resolución de conflictos de prioridad restringidas por rol (docs/permisos.md). */
class PriorityConflictAccessIntegrationTest extends IntegrationTestBase {

    private static final Map<String, Object> DECISION = Map.of(
            "conflictId", "NO-EXISTE", "decision", "KEEP_ORIGINAL");

    @Test
    void pendientesSoloParaAdmins() throws Exception {
        mockMvc.perform(as(Role.USUARIO, get("/api/priority/conflicts/pending"))).andExpect(status().isForbidden());
        for (Role role : new Role[]{Role.ADMIN_FULL, Role.ADMIN_CEREMONIAL, Role.ADMIN_TECNICA}) {
            mockMvc.perform(as(role, get("/api/priority/conflicts/pending"))).andExpect(status().isOk());
        }
    }

    @Test
    void resolverSoloFullYCeremonial() throws Exception {
        mockMvc.perform(as(Role.USUARIO, json(post("/api/priority/decisions"), DECISION))).andExpect(status().isForbidden());
        mockMvc.perform(as(Role.ADMIN_TECNICA, json(post("/api/priority/decisions"), DECISION))).andExpect(status().isForbidden());
        // Autorizado: llega al servicio y responde 404 porque el conflicto no existe.
        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, json(post("/api/priority/decisions"), DECISION))).andExpect(status().isNotFound());
    }

    /** Hallazgo 3.4: CANCELLED no tenía efecto real y se eliminó del contrato. */
    @Test
    void decisionCancelledYaNoExiste() throws Exception {
        Map<String, Object> cancelled = Map.of("conflictId", "NO-EXISTE", "deciderUserId", 1, "decision", "CANCELLED");
        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/priority/decisions"), cancelled)))
                .andExpect(status().isBadRequest());
    }
}
