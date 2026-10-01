package com.mvp.backend.feature.requests;

import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 2.4: la bandeja administrativa tiene endpoint propio, autenticado y con todos los estados. */
class AdminRequestInboxIntegrationTest extends IntegrationTestBase {

    @Test
    void bandejaIncluyeRechazadasYSoloParaAdmins() throws Exception {
        EventRequest rejected = createPublicRequest();
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/admin/event-requests/{id}/status", rejected.getId()),
                        Map.of("newStatus", "RECHAZADO", "reason", "Fuera de calendario académico"))))
                .andExpect(status().isOk());

        mockMvc.perform(as(Role.ADMIN_CEREMONIAL, get("/admin/event-requests")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id").value(hasItem(rejected.getId().intValue())));

        mockMvc.perform(as(Role.ADMIN_TECNICA, get("/admin/event-requests").param("status", "RECIBIDO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id").value(not(hasItem(rejected.getId().intValue()))));

        mockMvc.perform(as(Role.USUARIO, get("/admin/event-requests"))).andExpect(status().isForbidden());
        mockMvc.perform(get("/admin/event-requests")).andExpect(status().is4xxClientError());
    }

    /** Hallazgo 1.2: el listado de solicitudes (con datos personales) ya no es público. */
    @Test
    void listadoPublicoDeSolicitudesYaNoExiste() throws Exception {
        createPublicRequest();
        mockMvc.perform(get("/public/event-requests")).andExpect(status().is4xxClientError());
    }
}
