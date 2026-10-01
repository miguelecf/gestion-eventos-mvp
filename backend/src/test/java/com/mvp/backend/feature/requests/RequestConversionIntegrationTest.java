package com.mvp.backend.feature.requests;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.TechSupportMode;
import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 3.2: el soporte técnico del evento se define al convertir la solicitud. */
class RequestConversionIntegrationTest extends IntegrationTestBase {

    private Event convert(EventRequest request, Object body) throws Exception {
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/admin/event-requests/{id}/status", request.getId()),
                        Map.of("newStatus", "EN_REVISION"))))
                .andExpect(status().isOk());
        var req = post("/admin/event-requests/{id}/convert-to-event", request.getId());
        String res = mockMvc.perform(as(Role.ADMIN_FULL, body == null ? req : json(req, body)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return eventRepository.findById(objectMapper.readTree(res).get("id").asLong()).orElseThrow();
    }

    @Test
    void conversionConSoporteTecnico() throws Exception {
        Event event = convert(createPublicRequest(), Map.of("requiresTech", true, "techSupportMode", "ATTENDED"));
        assertThat(event.isRequiresTech()).isTrue();
        assertThat(event.getTechSupportMode()).isEqualTo(TechSupportMode.ATTENDED);
    }

    @Test
    void conversionSinBodyNoRequiereSoporte() throws Exception {
        Event event = convert(createPublicRequest(), null);
        assertThat(event.isRequiresTech()).isFalse();
    }
}
