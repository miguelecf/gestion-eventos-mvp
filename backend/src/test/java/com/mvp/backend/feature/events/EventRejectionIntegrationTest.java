package com.mvp.backend.feature.events;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 6.3: rechazar un evento exige motivo también en la API. */
class EventRejectionIntegrationTest extends IntegrationTestBase {

    @Test
    void rechazoSinMotivoDevuelve400YNoCambiaEstado() throws Exception {
        Event event = newEvent(Status.EN_REVISION);

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/status", event.getId()),
                        Map.of("to", "RECHAZADO", "reason", "  "))))
                .andExpect(status().isBadRequest());

        assertThat(eventRepository.findById(event.getId()).orElseThrow().getStatus()).isEqualTo(Status.EN_REVISION);
    }

    @Test
    void rechazoConMotivoFunciona() throws Exception {
        Event event = newEvent(Status.EN_REVISION);

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/status", event.getId()),
                        Map.of("to", "RECHAZADO", "reason", "Superposición con acto institucional"))))
                .andExpect(status().is2xxSuccessful());

        assertThat(eventRepository.findById(event.getId()).orElseThrow().getStatus()).isEqualTo(Status.RECHAZADO);
    }
}
