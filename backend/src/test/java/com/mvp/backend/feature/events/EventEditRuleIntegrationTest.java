package com.mvp.backend.feature.events;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EventEditRuleIntegrationTest extends IntegrationTestBase {

    @Test
    void rejectedEventCannotBeEdited() throws Exception {
        Event event = newEvent(Status.RECHAZADO);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()),
                        Map.of("name", "Updated event"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("No se puede editar un evento rechazado"));
    }

    @Test
    void approvedEventCanBeEditedAndDateChangeReturnsItToReview() throws Exception {
        Event event = newEvent(Status.APROBADO);
        LocalDate newDate = event.getDate().plusDays(1);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()),
                        Map.of("date", newDate.toString()))))
                .andExpect(status().isOk());

        Event updated = eventRepository.findById(event.getId()).orElseThrow();
        assertThat(updated.getDate()).isEqualTo(newDate);
        assertThat(updated.getStatus()).isEqualTo(Status.EN_REVISION);
    }
}
