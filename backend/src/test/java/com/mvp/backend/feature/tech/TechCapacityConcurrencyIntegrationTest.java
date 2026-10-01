package com.mvp.backend.feature.tech;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.events.model.TechSupportMode;
import com.mvp.backend.feature.tech.model.TechCapacityConfig;
import com.mvp.backend.feature.tech.repository.TechCapacityConfigRepository;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Hallazgos 5.2 (concurrencia) y 3.8 (buffers que cruzan medianoche) sobre capacidad técnica. */
class TechCapacityConcurrencyIntegrationTest extends IntegrationTestBase {

    @Autowired TechCapacityConfigRepository configRepository;

    private TechCapacityConfig config;

    @AfterEach
    void cleanup() {
        if (config != null) {
            configRepository.delete(config);
        }
    }

    private Event techEvent() {
        Event e = newEvent(Status.EN_REVISION);
        e.setRequiresTech(true);
        e.setTechSupportMode(TechSupportMode.ATTENDED);
        return eventRepository.save(e);
    }

    @Test
    void reservasConcurrentesRespetanUnCupo() throws Exception {
        config = configRepository.save(TechCapacityConfig.builder()
                .active(true).blockMinutes(30).defaultSlotsPerBlock(1).timezone("UTC").build());

        Event a = techEvent();
        Event b = techEvent(); // mismo día/horario (newEvent), distinto espacio
        String token = token(Role.ADMIN_FULL);
        String body = objectMapper.writeValueAsString(java.util.Map.of("to", "RESERVADO"));

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Integer>> results = new ArrayList<>();
        for (Event e : List.of(a, b)) {
            Callable<Integer> call = () -> {
                start.await();
                return mockMvc.perform(post("/api/events/{id}/status", e.getId())
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                                .contentType(MediaType.APPLICATION_JSON).content(body))
                        .andReturn().getResponse().getStatus();
            };
            results.add(pool.submit(call));
        }
        start.countDown();
        List<Integer> statuses = new ArrayList<>();
        for (Future<Integer> f : results) {
            statuses.add(f.get());
        }
        pool.shutdown();

        long reserved = eventRepository.findAllById(List.of(a.getId(), b.getId())).stream()
                .filter(e -> e.getStatus() == Status.RESERVADO).count();
        assertThat(reserved).as("estados HTTP %s", statuses).isEqualTo(1);
        assertThat(statuses).contains(409);
    }

    /** Hallazgo 3.8: el desmontaje técnico que cruza medianoche consume cupo del día siguiente. */
    @Test
    void bufferTecnicoQueCruzaMedianocheConsumeCupoDelDiaSiguiente() throws Exception {
        config = configRepository.save(TechCapacityConfig.builder()
                .active(true).blockMinutes(30).defaultSlotsPerBlock(1).timezone("UTC").build());

        Event late = techEvent();
        late.setStatus(Status.RESERVADO);
        late.setScheduleFrom(java.time.LocalTime.of(23, 0));
        late.setScheduleTo(java.time.LocalTime.of(23, 45));
        late.setBufferAfterMin(60); // ocupa hasta las 00:45 del día siguiente
        eventRepository.save(late);

        Event early = techEvent();
        early.setDate(late.getDate().plusDays(1));
        early.setScheduleFrom(java.time.LocalTime.of(0, 0));
        early.setScheduleTo(java.time.LocalTime.of(0, 30));
        eventRepository.save(early);

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/status", early.getId()), java.util.Map.of("to", "RESERVADO"))))
                .andExpect(status().isConflict());

        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/tech/capacity").param("date", early.getDate().toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks[0].from").value("00:00"))
                .andExpect(jsonPath("$.blocks[0].used").value(1))
                .andExpect(jsonPath("$.blocks[2].used").value(0)); // 01:00 ya libre
    }
}
