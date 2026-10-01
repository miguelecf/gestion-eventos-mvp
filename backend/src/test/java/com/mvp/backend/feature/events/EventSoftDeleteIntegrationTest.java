package com.mvp.backend.feature.events;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgos 2.2 y 4.5: la baja lógica funciona por PATCH y queda auditada con su actor. */
class EventSoftDeleteIntegrationTest extends IntegrationTestBase {

    @Test
    void softDeleteRegistraAuditoriaConActor() throws Exception {
        Event event = newEvent(Status.EN_REVISION);

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, patch("/api/events/{id}/soft-delete", event.getId())))
                .andExpect(status().isNoContent());
        // Segunda baja: idempotente, no duplica la entrada.
        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, patch("/api/events/{id}/soft-delete", event.getId())))
                .andExpect(status().isNoContent());

        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/audit/{id}", event.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.type == 'EVENT_DELETED')]").value(org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.entries[?(@.type == 'EVENT_DELETED')].actor.username")
                        .value(hasItem(user(Role.ADMIN_CEREMONIAL).getUsername())));
    }
}
