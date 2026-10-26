package com.mvp.backend.feature.events;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REV-07 (TECH-01): las transiciones de un evento se serializan y una escritura sobre una versión
 * vieja se rechaza en lugar de pisar la más nueva.
 */
class EventConcurrencyIntegrationTest extends IntegrationTestBase {

    @RepeatedTest(3)
    void conformidadesSimultaneasDeAmbasAreasNoSePierden() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        String body = objectMapper.writeValueAsString(Map.of("to", "APROBADO"));

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Integer>> results = new ArrayList<>();
        for (String token : List.of(token(Role.ADMIN_CEREMONIAL), token(Role.ADMIN_TECNICA))) {
            results.add(pool.submit(() -> {
                start.await();
                return mockMvc.perform(post("/api/events/{id}/status", event.getId())
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                                .contentType(MediaType.APPLICATION_JSON).content(body))
                        .andReturn().getResponse().getStatus();
            }));
        }
        start.countDown();
        List<Integer> statuses = new ArrayList<>();
        for (Future<Integer> f : results) {
            statuses.add(f.get());
        }
        pool.shutdown();

        // Una respuesta parcial (202) y una aprobación (200), en cualquier orden.
        assertThat(statuses).containsExactlyInAnyOrder(200, 202);
        Event after = eventRepository.findById(event.getId()).orElseThrow();
        assertThat(after.isCeremonialOk()).isTrue();
        assertThat(after.isTechnicalOk()).isTrue();
        assertThat(after.getStatus()).isEqualTo(Status.APROBADO);
    }

    @Test
    void guardarUnaVersionViejaDelEventoFalla() throws Exception {
        Event stale = newEvent(Status.EN_REVISION);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", stale.getId()), Map.of("observations", "Primera edición"))))
                .andExpect(status().isOk());

        stale.setObservations("Edición sobre la copia vieja");
        assertThatThrownBy(() -> eventRepository.save(stale))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
    }

    /** REV-18: edición y reserva del mismo evento técnico a la vez terminan sin error de servidor. */
    @RepeatedTest(3)
    void edicionYReservaSimultaneasNoTerminanEnErrorDeServidor() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        event.setRequiresTech(true);
        event.setTechSupportMode(com.mvp.backend.feature.events.model.TechSupportMode.SETUP_ONLY);
        eventRepository.save(event);
        String token = token(Role.ADMIN_FULL);

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        Future<Integer> edit = pool.submit(() -> {
            start.await();
            return mockMvc.perform(patch("/api/events/{id}", event.getId())
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("observations", "Edición concurrente"))))
                    .andReturn().getResponse().getStatus();
        });
        Future<Integer> reserve = pool.submit(() -> {
            start.await();
            return mockMvc.perform(post("/api/events/{id}/status", event.getId())
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("to", "RESERVADO"))))
                    .andReturn().getResponse().getStatus();
        });
        start.countDown();
        int editStatus = edit.get();
        int reserveStatus = reserve.get();
        pool.shutdown();

        assertThat(editStatus).isIn(200, 409);
        assertThat(reserveStatus).isIn(200, 409);
    }
}
