package com.mvp.backend.feature.availability;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgo 3.8: un buffer que cruza medianoche se detecta contra eventos del día adyacente. */
class CrossMidnightAvailabilityIntegrationTest extends IntegrationTestBase {

    @Test
    void desmontajeQueCruzaMedianocheChocaConElDiaSiguiente() throws Exception {
        // Evento reservado el día D de 22:00 a 23:30 con 60' de desmontaje: ocupa hasta las 00:30 de D+1.
        Event late = newEvent(Status.RESERVADO);
        late.setScheduleFrom(LocalTime.of(22, 0));
        late.setScheduleTo(LocalTime.of(23, 30));
        late.setBufferAfterMin(60);
        eventRepository.save(late);
        String nextDay = late.getDate().plusDays(1).toString();
        Long spaceId = late.getSpace().getId();

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/availability/check"), Map.of(
                        "date", nextDay, "spaceId", spaceId,
                        "scheduleFrom", "00:00", "scheduleTo", "01:00",
                        "bufferBeforeMin", 0, "bufferAfterMin", 0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isAvailable").value(false))
                .andExpect(jsonPath("$.conflicts[0].eventId").value(late.getId()));

        // A partir de las 00:30 queda libre.
        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/availability/check"), Map.of(
                        "date", nextDay, "spaceId", spaceId,
                        "scheduleFrom", "00:30", "scheduleTo", "01:30",
                        "bufferBeforeMin", 0, "bufferAfterMin", 0))))
                .andExpect(jsonPath("$.isAvailable").value(true));

        // La ocupación pública del día siguiente muestra la franja 00:00–00:30.
        mockMvc.perform(get("/public/spaces/{id}/occupancy", spaceId).param("date", nextDay))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks[0].from").value("00:00"))
                .andExpect(jsonPath("$.blocks[0].to").value("00:30"));
    }
}
