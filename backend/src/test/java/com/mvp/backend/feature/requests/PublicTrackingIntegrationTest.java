package com.mvp.backend.feature.requests;

import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgos 1.1 y 1.3: el tracking público no expone comentarios internos ni datos administrativos. */
class PublicTrackingIntegrationTest extends IntegrationTestBase {

    private static final String SECRETO = "Comentario interno: el decano no quiere este evento";

    @Test
    void trackingNoExponeComentariosNiDatosInternos() throws Exception {
        EventRequest request = createPublicRequest();

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/admin/event-requests/{id}/status", request.getId()),
                        Map.of("newStatus", "EN_REVISION"))))
                .andExpect(status().isOk());
        String converted = mockMvc.perform(as(Role.ADMIN_FULL, post("/admin/event-requests/{id}/convert-to-event", request.getId())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long eventId = objectMapper.readTree(converted).get("id").asLong();

        String commentRes = mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/comments", eventId), Map.of("body", SECRETO))))
                .andExpect(status().is2xxSuccessful())
                .andReturn().getResponse().getContentAsString();
        long commentId = objectMapper.readTree(commentRes).get("id").asLong();
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}/comments/{cid}", eventId, commentId),
                        Map.of("body", SECRETO + " (editado)"))))
                .andExpect(status().is2xxSuccessful());

        String body = mockMvc.perform(get("/public/track/{uuid}", request.getTrackingUuid()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.request.status").value("CONVERTIDO"))
                .andExpect(jsonPath("$.event.status").value("EN_REVISION"))
                .andExpect(jsonPath("$.event.id").doesNotExist())
                .andExpect(jsonPath("$.event.internal").doesNotExist())
                .andExpect(jsonPath("$.location.spaceId").doesNotExist())
                .andExpect(jsonPath("$.department").doesNotExist())
                .andExpect(jsonPath("$.schedule.bufferBeforeMin").doesNotExist())
                .andExpect(jsonPath("$.schedule.technical").doesNotExist())
                .andExpect(jsonPath("$.timeline[*].details").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("decano");
        assertThat(objectMapper.readTree(body).get("timeline")).allSatisfy(entry ->
                assertThat(entry.get("type").asText()).isIn("STATUS", "SCHEDULE_CHANGE"));
    }
}
