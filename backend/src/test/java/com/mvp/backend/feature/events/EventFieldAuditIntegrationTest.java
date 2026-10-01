package com.mvp.backend.feature.events;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 4.4: cada campo de negocio modificado deja su entrada FIELD_UPDATE. */
class EventFieldAuditIntegrationTest extends IntegrationTestBase {

    @Test
    void edicionAuditaCampoPorCampo() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        String longObservations = "x".repeat(400);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of(
                        "name", "Nombre nuevo",
                        "contactEmail", "nuevo@test.local",
                        "observations", longObservations))))
                .andExpect(status().isOk());

        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/audit/{id}", event.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.type == 'FIELD_UPDATE')].field")
                        .value(org.hamcrest.Matchers.containsInAnyOrder("name", "contactEmail", "observations")))
                .andExpect(jsonPath("$.entries[?(@.field == 'name')].toValue").value(hasItem("Nombre nuevo")))
                .andExpect(jsonPath("$.entries[?(@.field == 'priority')]").value(hasSize(0)))
                .andExpect(jsonPath("$.entries[?(@.field == 'observations')].toValue")
                        .value(not(hasItem(longObservations))));
    }
}
