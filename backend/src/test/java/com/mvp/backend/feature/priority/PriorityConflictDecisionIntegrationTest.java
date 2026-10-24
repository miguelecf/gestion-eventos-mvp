package com.mvp.backend.feature.priority;

import com.mvp.backend.feature.catalogs.model.Space;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.priority.model.PriorityConflict;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 1.7 y SEC-06: el decisor de un conflicto es el usuario autenticado, no un ID enviado por el cliente. */
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

    /** SEC-06: al reubicar, el decisor, el último modificador y las dos auditorías también son el principal. */
    @Test
    void reubicarIgnoraElDecisorDelClienteEnEventoYAuditoria() throws Exception {
        PriorityConflict conflict = newPriorityConflict();
        Long displacedId = tx.execute(s -> priorityConflictRepository.findById(conflict.getId()).orElseThrow().getDisplacedEvent().getId());
        // AC decide; el fixture lo creó AF, así que un decisor tomado de otro lado no coincide por casualidad.
        Long principal = user(Role.ADMIN_CEREMONIAL).getId();
        Long otroUsuario = user(Role.ADMIN_FULL).getId();
        Space destino = newSpace();

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, json(post("/api/priority/decisions"), Map.of(
                        "conflictId", conflict.getConflictCode(),
                        "deciderUserId", otroUsuario, // intento de suplantación: debe ignorarse
                        "decision", "REBOOK_OTHER",
                        "target", Map.of(
                                "date", LocalDate.now().plusYears(1).plusDays(1).toString(),
                                "from", "14:00",
                                "to", "16:00",
                                "spaceId", destino.getId())))))
                .andExpect(status().isCreated());

        tx.executeWithoutResult(s -> {
            assertThat(priorityConflictRepository.findById(conflict.getId()).orElseThrow().getDecisionBy().getId())
                    .isEqualTo(principal);
            Event displaced = eventRepository.findById(displacedId).orElseThrow();
            assertThat(displaced.getSpace().getId()).isEqualTo(destino.getId());
            assertThat(displaced.getLastModifiedBy().getId()).isEqualTo(principal);
        });
        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/audit/{id}", displacedId)))
                .andExpect(jsonPath("$.entries[?(@.type == 'PRIORITY_CONFLICT' && @.toValue == 'CLOSED')].actor.id")
                        .value(contains(principal.intValue())))
                .andExpect(jsonPath("$.entries[?(@.type == 'SCHEDULE_CHANGE')].actor.id").value(contains(principal.intValue())));
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
