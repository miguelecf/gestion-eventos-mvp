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
}
