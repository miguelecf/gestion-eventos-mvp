package com.mvp.backend.feature.requests;

import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.feature.requests.model.RequestStatus;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REV-06: dos conversiones simultáneas de la misma solicitud crean un solo evento. La solicitud se
 * bloquea al leerla, así que la segunda ve el estado CONVERTIDO y se rechaza.
 */
class RequestConversionConcurrencyIntegrationTest extends IntegrationTestBase {

    @RepeatedTest(3)
    void conversionesSimultaneasCreanUnSoloEvento() throws Exception {
        EventRequest request = createPublicRequest();
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/admin/event-requests/{id}/status", request.getId()),
                        Map.of("newStatus", "EN_REVISION"))))
                .andExpect(status().isOk());

        String token = token(Role.ADMIN_FULL);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Integer>> results = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            results.add(pool.submit(() -> {
                start.await();
                return mockMvc.perform(post("/admin/event-requests/{id}/convert-to-event", request.getId())
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                                .contentType(MediaType.APPLICATION_JSON))
                        .andReturn().getResponse().getStatus();
            }));
        }
        start.countDown();
        List<Integer> statuses = new ArrayList<>();
        for (Future<Integer> f : results) {
            statuses.add(f.get());
        }
        pool.shutdown();

        assertThat(statuses).filteredOn(s -> s < 300).hasSize(1);
        assertThat(statuses).filteredOn(s -> s >= 400 && s < 500).hasSize(1);
        assertThat(eventRepository.findAll()).filteredOn(e -> e.getName().equals(request.getName())).hasSize(1);
        assertThat(eventRequestRepository.findById(request.getId()).orElseThrow().getStatus())
                .isEqualTo(RequestStatus.CONVERTIDO);
    }
}
