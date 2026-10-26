package com.mvp.backend.feature.priority;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.notifications.event.EventRescheduledEmailEvent;
import com.mvp.backend.feature.notifications.event.EventStatusChangedEvent;
import com.mvp.backend.feature.priority.model.PriorityConflict;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REV-14 (RN-05): reubicar un evento comprometido por un conflicto de prioridad es una modificación
 * relevante. Vuelve a revisión, reinicia las conformidades y avisa como cualquier reprogramación.
 * La vuelta a revisión por una edición también publica el cambio de estado.
 */
@RecordApplicationEvents
class RebookingRevisionIntegrationTest extends IntegrationTestBase {

    @Autowired TransactionTemplate tx;
    @Autowired ApplicationEvents events;

    @Test
    void reubicarUnEventoReservadoLoDevuelveARevisionYAvisa() throws Exception {
        PriorityConflict conflict = newPriorityConflict();
        Long displacedId = tx.execute(s -> {
            Event displaced = priorityConflictRepository.findById(conflict.getId()).orElseThrow().getDisplacedEvent();
            displaced.setCeremonialOk(true);
            displaced.setTechnicalOk(true);
            return eventRepository.save(displaced).getId();
        });

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/priority/decisions"), Map.of(
                        "conflictId", conflict.getConflictCode(),
                        "decision", "REBOOK_OTHER",
                        "target", Map.of(
                                "date", LocalDate.now().plusYears(1).plusDays(2).toString(),
                                "from", "14:00",
                                "to", "16:00",
                                "spaceId", newSpace().getId())))))
                .andExpect(status().isCreated());

        Event after = eventRepository.findById(displacedId).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(Status.EN_REVISION);
        assertThat(after.isCeremonialOk()).isFalse();
        assertThat(after.isTechnicalOk()).isFalse();
        assertThat(events.stream(EventStatusChangedEvent.class)
                .filter(e -> e.eventId().equals(displacedId) && e.newStatus() == Status.EN_REVISION)).hasSize(1);
        assertThat(events.stream(EventRescheduledEmailEvent.class)
                .filter(e -> e.eventId().equals(displacedId))).hasSize(1);
        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/audit/{id}", displacedId)))
                .andExpect(jsonPath("$.entries[?(@.type == 'STATUS' && @.toValue == 'EN_REVISION')]").value(hasSize(1)))
                .andExpect(jsonPath("$.entries[?(@.type == 'FIELD_UPDATE' && @.field == 'technical_ok')]").value(hasSize(1)));
    }

    @Test
    void laVueltaARevisionPorUnaEdicionPublicaElCambioDeEstado() throws Exception {
        Event event = newEvent(Status.APROBADO);

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, json(patch("/api/events/{id}", event.getId()), Map.of("bufferAfterMin", 15))))
                .andExpect(status().isOk());

        assertThat(events.stream(EventStatusChangedEvent.class)
                .filter(e -> e.eventId().equals(event.getId())
                        && e.oldStatus() == Status.APROBADO
                        && e.newStatus() == Status.EN_REVISION)).hasSize(1);
    }
}
