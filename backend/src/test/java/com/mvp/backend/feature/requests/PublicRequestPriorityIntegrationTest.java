package com.mvp.backend.feature.requests;

import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.shared.Priority;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REV-04: el solicitante anónimo no elige la prioridad (RN-09). Si la eligiera, la conversión la
 * copiaría al evento y una prioridad Alta habilitaría el desplazamiento de otros eventos al reservar.
 */
class PublicRequestPriorityIntegrationTest extends IntegrationTestBase {

    @Test
    void laSolicitudPublicaIgnoraLaPrioridadEnviadaYQuedaEnMedia() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("date", LocalDate.now().plusYears(1).toString());
        body.put("scheduleFrom", "10:00");
        body.put("scheduleTo", "12:00");
        body.put("space_id", newSpace().getId());
        body.put("name", "Solicitud con prioridad");
        body.put("priority", "HIGH");
        body.put("audienceType", "ESTUDIANTES");
        body.put("contactName", "Ana Solicitante");
        body.put("contactEmail", "ana@test.local");
        body.put("contactPhone", "+54 11 5555-5555");

        String res = mockMvc.perform(json(post("/public/event-requests"), body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String uuid = objectMapper.readTree(res).get("tracking_uuid").asText();
        EventRequest saved = eventRequestRepository.findByTrackingUuid(uuid).orElseThrow();
        assertThat(saved.getPriority()).isEqualTo(Priority.MEDIUM);
    }
}
