package com.mvp.backend.feature.priority;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.priority.model.PriorityConflict;
import com.mvp.backend.feature.priority.model.PriorityConflictStatus;
import com.mvp.backend.feature.priority.repository.PriorityConflictRepository;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 1.7: el decisor de un conflicto es el usuario autenticado, no un ID enviado por el cliente. */
class PriorityConflictDecisionIntegrationTest extends IntegrationTestBase {

    @Autowired PriorityConflictRepository conflictRepository;
    @Autowired TransactionTemplate tx;

    private PriorityConflict newConflict() {
        Event high = newEvent(Status.RESERVADO);
        Event displaced = newEvent(Status.RESERVADO);
        return conflictRepository.save(PriorityConflict.builder()
                .conflictCode("IT-" + UUID.randomUUID().toString().substring(0, 8))
                .highEvent(high)
                .displacedEvent(displaced)
                .spaceId(displaced.getSpace().getId())
                .date(displaced.getDate())
                .fromTime(displaced.getScheduleFrom())
                .toTime(displaced.getScheduleTo())
                .status(PriorityConflictStatus.OPEN)
                .createdBy(user(Role.ADMIN_FULL))
                .createdAt(Instant.now())
                .build());
    }

    @Test
    void elDecisorEsElPrincipalAunqueElClienteMandeOtroId() throws Exception {
        PriorityConflict conflict = newConflict();
        Long otroUsuario = user(Role.ADMIN_FULL).getId();

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, json(post("/api/priority/decisions"), Map.of(
                        "conflictId", conflict.getConflictCode(),
                        "deciderUserId", otroUsuario, // intento de suplantación: debe ignorarse
                        "decision", "KEEP_ORIGINAL"))))
                .andExpect(status().isCreated());

        Long deciderId = tx.execute(s -> conflictRepository.findById(conflict.getId()).orElseThrow().getDecisionBy().getId());
        assertThat(deciderId).isEqualTo(user(Role.ADMIN_CEREMONIAL).getId());
    }
}
