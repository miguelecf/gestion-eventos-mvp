package com.mvp.backend.feature.priority;

import com.mvp.backend.feature.priority.model.PriorityConflict;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 1.7: el decisor de un conflicto es el usuario autenticado, no un ID enviado por el cliente. */
class PriorityConflictDecisionIntegrationTest extends IntegrationTestBase {

    @Autowired TransactionTemplate tx;

    @Test
    void elDecisorEsElPrincipalAunqueElClienteMandeOtroId() throws Exception {
        PriorityConflict conflict = newPriorityConflict();
        Long otroUsuario = user(Role.ADMIN_FULL).getId();

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, json(post("/api/priority/decisions"), Map.of(
                        "conflictId", conflict.getConflictCode(),
                        "deciderUserId", otroUsuario, // intento de suplantación: debe ignorarse
                        "decision", "KEEP_ORIGINAL"))))
                .andExpect(status().isCreated());

        Long deciderId = tx.execute(s -> priorityConflictRepository.findById(conflict.getId()).orElseThrow().getDecisionBy().getId());
        assertThat(deciderId).isEqualTo(user(Role.ADMIN_CEREMONIAL).getId());
    }

    /** Hallazgo 4.6: la resolución queda en la bitácora del evento desplazado, con decisión y motivo. */
    @Test
    void resolucionQuedaEnElHistorialDelEventoDesplazado() throws Exception {
        PriorityConflict conflict = newPriorityConflict();
        Long displacedId = tx.execute(s -> priorityConflictRepository.findById(conflict.getId()).orElseThrow().getDisplacedEvent().getId());

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/priority/decisions"), Map.of(
                        "conflictId", conflict.getConflictCode(),
                        "decision", "KEEP_ORIGINAL",
                        "reason", "El evento original ya tenía difusión"))))
                .andExpect(status().isCreated());

        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/audit/{id}", displacedId)))
                .andExpect(jsonPath("$.entries[?(@.type == 'PRIORITY_CONFLICT' && @.toValue == 'CLOSED')]").value(hasSize(1)))
                .andExpect(jsonPath("$.entries[?(@.type == 'PRIORITY_CONFLICT')].reason").value(org.hamcrest.Matchers.hasItem("El evento original ya tenía difusión")));
    }
}
