package com.mvp.backend.feature.events;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hallazgos 2.2 y 4.5: la baja lógica funciona por PATCH y queda auditada con su actor.
 * REV-02: un evento dado de baja sale de todas las consultas operativas, no solo del listado.
 */
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

    @Test
    void eventoDadoDeBajaNoApareceEnLasConsultasOperativas() throws Exception {
        Event activo = newEvent(Status.EN_REVISION);
        Event baja = newEvent(Status.EN_REVISION);
        mockMvc.perform(as(Role.ADMIN_FULL, patch("/api/events/{id}/soft-delete", baja.getId())))
                .andExpect(status().isNoContent());

        String fecha = activo.getDate().toString();
        Long creador = activo.getCreatedBy().getId();
        for (var request : new org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder[]{
                get("/api/events/date").param("date", fecha),
                get("/api/events/range").param("start", fecha).param("end", fecha),
                get("/api/events/status/EN_REVISION"),
                get("/api/events/priority/MEDIUM"),
                get("/api/events/user/{userId}", creador)}) {
            mockMvc.perform(as(Role.USUARIO, request))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].id").value(hasItem(activo.getId().intValue())))
                    .andExpect(jsonPath("$[*].id").value(not(hasItem(baja.getId().intValue()))));
        }
    }
}
