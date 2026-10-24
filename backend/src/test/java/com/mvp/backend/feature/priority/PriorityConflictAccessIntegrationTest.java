package com.mvp.backend.feature.priority;

import com.mvp.backend.feature.priority.model.PriorityConflict;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hallazgo 1.6 y SEC-05: consulta y resolución de conflictos de prioridad restringidas por rol
 * (fila priority.read y priority.resolve de la matriz; docs/permisos.md).
 */
class PriorityConflictAccessIntegrationTest extends IntegrationTestBase {

    private static final Map<String, Object> DECISION = Map.of(
            "conflictId", "NO-EXISTE", "decision", "KEEP_ORIGINAL");

    @Test
    void pendientesSoloParaAdmins() throws Exception {
        PriorityConflict conflict = newPriorityConflict();

        mockMvc.perform(get("/api/priority/conflicts/pending")).andExpect(status().isForbidden());
        mockMvc.perform(as(Role.USUARIO, get("/api/priority/conflicts/pending"))).andExpect(status().isForbidden());
        // Los tres roles admin consultan y reciben el conflicto abierto, no solo una página vacía.
        for (Role role : new Role[]{Role.ADMIN_FULL, Role.ADMIN_CEREMONIAL, Role.ADMIN_TECNICA}) {
            mockMvc.perform(as(role, get("/api/priority/conflicts/pending").param("size", "200")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].conflictId").value(hasItem(conflict.getConflictCode())));
        }
    }

    @Test
    void conflictosDeUnEventoSoloParaAdmins() throws Exception {
        PriorityConflict conflict = newPriorityConflict();
        Long highEventId = conflict.getHighEvent().getId();

        mockMvc.perform(get("/api/priority/conflicts").param("eventId", highEventId.toString()))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(Role.USUARIO, get("/api/priority/conflicts").param("eventId", highEventId.toString())))
                .andExpect(status().isForbidden());
        for (Role role : new Role[]{Role.ADMIN_FULL, Role.ADMIN_CEREMONIAL, Role.ADMIN_TECNICA}) {
            mockMvc.perform(as(role, get("/api/priority/conflicts").param("eventId", highEventId.toString())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.conflicts[*].conflictId").value(hasItem(conflict.getConflictCode())));
        }
    }

    /**
     * SEC-05: Spring MVC atiende HEAD con el handler GET; antes HEAD caía en anyRequest().authenticated()
     * y USUARIO recibía 200 (la consulta se ejecutaba, aunque sin cuerpo). Los métodos sin handler
     * daban 405 en lugar de 403.
     */
    @Test
    void usuarioNoConsultaConflictosConOtrosMetodos() throws Exception {
        mockMvc.perform(as(Role.USUARIO, head("/api/priority/conflicts/pending"))).andExpect(status().isForbidden());
        mockMvc.perform(as(Role.USUARIO, head("/api/priority/conflicts").param("eventId", "1")))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(Role.USUARIO, delete("/api/priority/conflicts/pending"))).andExpect(status().isForbidden());
        // AT sí puede consultar: HEAD sigue permitido para los roles de priority.read.
        mockMvc.perform(as(Role.ADMIN_TECNICA, head("/api/priority/conflicts/pending"))).andExpect(status().isOk());
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
