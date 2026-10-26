package com.mvp.backend.feature.events;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REV-10 (RN-05, filas event.approveCeremonial y event.approveTechnical de permisos.json): cada área
 * otorga y retira solo su conformidad; ADMIN_FULL puede las dos.
 */
class EventConformityPermissionsIntegrationTest extends IntegrationTestBase {

    private Event reload(Event e) {
        return eventRepository.findById(e.getId()).orElseThrow();
    }

    @Test
    void ceremonialYTecnicaAprobandoPorSeparadoLlegaAAprobado() throws Exception {
        Event event = newEvent(Status.EN_REVISION);

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, json(post("/api/events/{id}/status", event.getId()), Map.of("to", "APROBADO"))))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.missing").value(contains("technical_ok")));
        assertThat(reload(event).getStatus()).isEqualTo(Status.EN_REVISION);
        assertThat(reload(event).isCeremonialOk()).isTrue();

        mockMvc.perform(as(Role.ADMIN_TECNICA, json(post("/api/events/{id}/status", event.getId()), Map.of("to", "APROBADO"))))
                .andExpect(status().isOk());
        assertThat(reload(event).getStatus()).isEqualTo(Status.APROBADO);
    }

    @Test
    void adminFullOtorgaAmbasConformidades() throws Exception {
        Event event = newEvent(Status.EN_REVISION);

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/status", event.getId()), Map.of("to", "APROBADO"))))
                .andExpect(status().isOk());

        Event after = reload(event);
        assertThat(after.getStatus()).isEqualTo(Status.APROBADO);
        assertThat(after.isCeremonialOk()).isTrue();
        assertThat(after.isTechnicalOk()).isTrue();
    }

    @Test
    void ningunaAreaRetiraLaConformidadDeLaOtra() throws Exception {
        Event event = newEvent(Status.RESERVADO);
        event.setCeremonialOk(true);
        event.setTechnicalOk(true);
        eventRepository.save(event);

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, json(post("/api/events/{id}/status", event.getId()),
                        Map.of("to", "EN_REVISION", "technicalOk", false))))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(Role.ADMIN_TECNICA, json(post("/api/events/{id}/status", event.getId()),
                        Map.of("to", "EN_REVISION", "ceremonialOk", false))))
                .andExpect(status().isForbidden());

        Event after = reload(event);
        assertThat(after.getStatus()).isEqualTo(Status.RESERVADO);
        assertThat(after.isCeremonialOk()).isTrue();
        assertThat(after.isTechnicalOk()).isTrue();

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/status", event.getId()),
                        Map.of("to", "EN_REVISION", "ceremonialOk", false, "technicalOk", false))))
                .andExpect(status().isOk());
        assertThat(reload(event).isCeremonialOk()).isFalse();
        assertThat(reload(event).isTechnicalOk()).isFalse();
    }
}
