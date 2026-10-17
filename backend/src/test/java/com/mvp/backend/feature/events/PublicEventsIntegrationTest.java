package com.mvp.backend.feature.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** SEC-02: el calendario público no expone datos personales del solicitante ni datos de gestión. */
class PublicEventsIntegrationTest extends IntegrationTestBase {

    @Test
    void calendarioPublicoNoExponeContactoNiDatosDeGestion() throws Exception {
        EventRequest request = createPublicRequest();
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/admin/event-requests/{id}/status", request.getId()),
                        Map.of("newStatus", "EN_REVISION"))))
                .andExpect(status().isOk());
        String converted = mockMvc.perform(as(Role.ADMIN_FULL, post("/admin/event-requests/{id}/convert-to-event", request.getId())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long eventId = objectMapper.readTree(converted).get("id").asLong();
        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/status", eventId), Map.of("to", "APROBADO"))))
                .andExpect(status().isOk());

        String body = mockMvc.perform(get("/public/events"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode event = StreamSupport.stream(objectMapper.readTree(body).spliterator(), false)
                .filter(node -> node.get("id").asLong() == eventId)
                .findFirst().orElseThrow();
        assertThat(event.get("name").asText()).isEqualTo(request.getName());
        assertThat(event.get("scheduleFrom").asText()).isEqualTo("10:00");
        assertThat(event.get("spaceName").asText()).isEqualTo(request.getSpace().getName());
        assertThat(event.has("contactName")).isFalse();
        assertThat(event.has("contactEmail")).isFalse();
        assertThat(event.has("contactPhone")).isFalse();
        assertThat(event.has("createdBy")).isFalse();
        assertThat(event.has("observations")).isFalse();
        assertThat(event.has("originRequestId")).isFalse();

        assertThat(body).doesNotContain(request.getContactName(), request.getContactEmail(),
                request.getContactPhone(), user(Role.ADMIN_FULL).getEmail());
    }
}
