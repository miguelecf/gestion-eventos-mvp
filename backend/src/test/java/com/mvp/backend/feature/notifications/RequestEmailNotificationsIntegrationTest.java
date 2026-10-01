package com.mvp.backend.feature.notifications;

import com.mvp.backend.feature.auth.service.EmailService;
import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Map;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 2.5: el solicitante recibe correo con código de seguimiento y en revisión, rechazo y conversión. */
class RequestEmailNotificationsIntegrationTest extends IntegrationTestBase {

    @MockitoBean EmailService emailService;

    @Test
    void altaIncluyeCodigoDeSeguimiento() throws Exception {
        EventRequest request = createPublicRequest();
        verify(emailService, timeout(3000)).send(eq(request.getContactEmail()), contains("Confirmación"),
                argThat(body -> body.contains(request.getTrackingUuid()) && body.contains("/track/")));
    }

    @Test
    void rechazoNotificaMotivo() throws Exception {
        EventRequest request = createPublicRequest();
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/admin/event-requests/{id}/status", request.getId()),
                        Map.of("newStatus", "RECHAZADO", "reason", "Fecha no disponible"))))
                .andExpect(status().isOk());
        verify(emailService, timeout(3000)).send(eq(request.getContactEmail()), contains("Novedades"),
                argThat(body -> body.contains("rechazada") && body.contains("Fecha no disponible")));
    }

    @Test
    void revisionYConversionNotifican() throws Exception {
        EventRequest request = createPublicRequest();
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/admin/event-requests/{id}/status", request.getId()),
                        Map.of("newStatus", "EN_REVISION"))))
                .andExpect(status().isOk());
        verify(emailService, timeout(3000)).send(eq(request.getContactEmail()), contains("Novedades"),
                argThat(body -> body.contains("revisada")));

        mockMvc.perform(as(Role.ADMIN_FULL, post("/admin/event-requests/{id}/convert-to-event", request.getId())))
                .andExpect(status().isOk());
        verify(emailService, timeout(3000)).send(eq(request.getContactEmail()), contains("Novedades"),
                argThat(body -> body.contains("convirtió en un evento")));
    }
}
