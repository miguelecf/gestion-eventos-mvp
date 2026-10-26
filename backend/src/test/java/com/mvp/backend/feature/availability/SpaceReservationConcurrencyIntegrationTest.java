package com.mvp.backend.feature.availability;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * REV-15 (RN-06, RNF-04): dos reservas simultáneas de eventos distintos en el mismo espacio y franja
 * no quedan las dos confirmadas. La ocupación se serializa por espacio.
 */
class SpaceReservationConcurrencyIntegrationTest extends IntegrationTestBase {

    @RepeatedTest(3)
    void reservasSimultaneasDelMismoEspacioConfirmanUnaSola() throws Exception {
        Event a = newEvent(Status.EN_REVISION);
        Event b = newEvent(Status.EN_REVISION);
        b.setSpace(a.getSpace());
        eventRepository.save(b);

        String token = token(Role.ADMIN_FULL);
        String body = objectMapper.writeValueAsString(Map.of("to", "RESERVADO"));
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Integer>> results = new ArrayList<>();
        for (Event e : List.of(a, b)) {
            results.add(pool.submit(() -> {
                start.await();
                return mockMvc.perform(post("/api/events/{id}/status", e.getId())
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

        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        assertThat(eventRepository.findAllById(List.of(a.getId(), b.getId())))
                .filteredOn(e -> e.getStatus() == Status.RESERVADO).hasSize(1);
    }
}
