package com.mvp.backend.feature.requests;

import com.mvp.backend.feature.catalogs.model.Space;
import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PublicRequestBufferDefaultsIntegrationTest extends IntegrationTestBase {

    @Test
    void omittedBuffersUseSpaceDefaults() throws Exception {
        Space space = spaceRepository.save(Space.builder()
                .name("Buffer defaults " + UUID.randomUUID())
                .capacity(100)
                .defaultBufferBeforeMin(15)
                .defaultBufferAfterMin(25)
                .build());
        Map<String, Object> body = Map.of(
                "date", LocalDate.now().plusYears(1).toString(),
                "scheduleFrom", "10:00",
                "scheduleTo", "12:00",
                "space_id", space.getId(),
                "name", "Request with space buffer defaults",
                "priority", "MEDIUM",
                "audienceType", "ESTUDIANTES",
                "contactName", "Ana Solicitante",
                "contactEmail", "ana@test.local",
                "contactPhone", "+54 11 5555-5555");

        String response = mockMvc.perform(json(post("/public/event-requests"), body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String trackingUuid = objectMapper.readTree(response).get("tracking_uuid").asText();
        EventRequest request = eventRequestRepository.findByTrackingUuid(trackingUuid).orElseThrow();

        assertThat(request.getBufferBeforeMin()).isEqualTo(15);
        assertThat(request.getBufferAfterMin()).isEqualTo(25);
    }
}
