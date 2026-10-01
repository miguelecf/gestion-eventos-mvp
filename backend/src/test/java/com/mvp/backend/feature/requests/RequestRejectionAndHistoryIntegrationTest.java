package com.mvp.backend.feature.requests;

import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgos 2.6, 4.1 y 4.2: motivo de rechazo obligatorio, historial con actor y endpoint admin. */
class RequestRejectionAndHistoryIntegrationTest extends IntegrationTestBase {

    private static final String MOTIVO = "El espacio está reservado para colación de grado";

    @Test
    void rechazoExigeMotivoYQuedaTrazado() throws Exception {
        EventRequest request = createPublicRequest();
        String observacionesOriginales = request.getObservations();

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, json(patch("/admin/event-requests/{id}/status", request.getId()),
                        Map.of("newStatus", "RECHAZADO"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, json(patch("/admin/event-requests/{id}/status", request.getId()),
                        Map.of("newStatus", "RECHAZADO", "reason", MOTIVO))))
                .andExpect(status().isOk());

        // No pisa las observaciones del solicitante.
        assertThat(eventRequestRepository.findById(request.getId()).orElseThrow().getObservations())
                .isEqualTo(observacionesOriginales);

        mockMvc.perform(as(Role.ADMIN_FULL, get("/admin/event-requests/{id}/history", request.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].toValue").value("RECIBIDO"))
                .andExpect(jsonPath("$[0].actor").doesNotExist())
                .andExpect(jsonPath("$[1].toValue").value("RECHAZADO"))
                .andExpect(jsonPath("$[1].reason").value(MOTIVO))
                .andExpect(jsonPath("$[1].actor.username").value(user(Role.ADMIN_CEREMONIAL).getUsername()));

        // El solicitante ve el motivo en el tracking público.
        mockMvc.perform(get("/public/track/{uuid}", request.getTrackingUuid()))
                .andExpect(jsonPath("$.request.status").value("RECHAZADO"))
                .andExpect(jsonPath("$.rejectionReason").value(MOTIVO));
    }

    @Test
    void historialSoloParaAdmins() throws Exception {
        EventRequest request = createPublicRequest();
        mockMvc.perform(as(Role.USUARIO, get("/admin/event-requests/{id}/history", request.getId())))
                .andExpect(status().isForbidden());
    }
}
