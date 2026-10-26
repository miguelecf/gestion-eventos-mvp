package com.mvp.backend.security;

import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Códigos de error vistos por un cliente HTTP real. MockMvc no ejecuta el despacho a /error que
 * hace el contenedor tras un sendError, así que no detecta si Spring Security lo bloquea: en ese
 * caso todo error de un anónimo llegaba como 403 vacío.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ErrorStatusOverHttpIntegrationTest extends IntegrationTestBase {

    @LocalServerPort
    private int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void loginConCredencialesInvalidasResponde401() throws Exception {
        user(Role.USUARIO);

        HttpResponse<String> response = post("/auth/login",
                "{\"username\":\"it.usuario\",\"password\":\"incorrecta\"}");

        assertThat(response.statusCode()).isEqualTo(401);
    }

    @Test
    void loginFallidoSumaUnIntento() throws Exception {
        int before = user(Role.USUARIO).getFailedLoginAttempts();

        post("/auth/login", "{\"username\":\"it.usuario\",\"password\":\"incorrecta\"}");

        assertThat(userRepository.findByUsername("it.usuario").orElseThrow().getFailedLoginAttempts())
                .isEqualTo(before + 1);
    }

    @Test
    void intentosFallidosSimultaneosSumanTodos() throws Exception {
        int before = user(Role.ADMIN_CEREMONIAL).getFailedLoginAttempts();
        String body = "{\"username\":\"it.admin_ceremonial\",\"password\":\"incorrecta\"}";

        var pool = java.util.concurrent.Executors.newFixedThreadPool(4);
        var start = new java.util.concurrent.CountDownLatch(1);
        var results = new java.util.ArrayList<java.util.concurrent.Future<HttpResponse<String>>>();
        for (int i = 0; i < 4; i++) {
            results.add(pool.submit(() -> {
                start.await();
                return post("/auth/login", body);
            }));
        }
        start.countDown();
        for (var result : results) {
            assertThat(result.get().statusCode()).isEqualTo(401);
        }
        pool.shutdown();

        assertThat(userRepository.findByUsername("it.admin_ceremonial").orElseThrow().getFailedLoginAttempts())
                .isEqualTo(before + 4);
    }

    @Test
    void trackingInexistenteResponde404() throws Exception {
        HttpResponse<String> response = get("/public/track/" + UUID.randomUUID(), null);

        assertThat(response.statusCode()).isEqualTo(404);
    }

    @Test
    void solicitudPublicaMalFormadaResponde400() throws Exception {
        HttpResponse<String> response = post("/public/event-requests", "{no es json");

        assertThat(response.statusCode()).isEqualTo(400);
    }

    @Test
    void apiInternaSinTokenResponde401() throws Exception {
        assertThat(get("/api/events", null).statusCode()).isEqualTo(401);
        assertThat(get("/api/events", "token.invalido.firmado").statusCode()).isEqualTo(401);
    }

    @Test
    void rolSinPermisoSigueRespondiendo403() throws Exception {
        assertThat(get("/api/users", token(Role.USUARIO)).statusCode()).isEqualTo(403);
    }

    private HttpResponse<String> get(String path, String bearer) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri(path)).GET();
        if (bearer != null) {
            builder.header("Authorization", "Bearer " + bearer);
        }
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(String path, String json) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(uri(path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
