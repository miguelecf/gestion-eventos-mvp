package com.mvp.backend.feature.notifications;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.shared.Priority;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REV-16: las notificaciones internas (comentarios, estados, conflictos) son para cuentas
 * administrativas. Una cuenta degradada a USUARIO deja de recibirlas y de leer las anteriores,
 * porque incluyen extractos de comentarios a los que ya no tiene acceso.
 */
class InternalNotificationAudienceIntegrationTest extends IntegrationTestBase {

    @Test
    void unaCuentaDegradadaNoRecibeNiLeeNotificacionesInternas() throws Exception {
        String username = "notif." + UUID.randomUUID().toString().substring(0, 8);
        User creator = userRepository.save(User.builder()
                .username(username).name("Cuenta").lastName("Notificada").email(username + "@test.local")
                .password(passwordEncoder.encode(PASSWORD)).priority(Priority.MEDIUM)
                .role("ADMIN_TECNICA").mustChangePassword(false).build());
        Event event = newEvent(Status.EN_REVISION);
        event.setCreatedBy(creator);
        eventRepository.save(event);

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/comments", event.getId()), Map.of("body", "Dato interno de coordinación"))))
                .andExpect(status().isCreated());
        String session = "Bearer " + login(username);
        mockMvc.perform(get("/api/notifications/count/unread").header(HttpHeaders.AUTHORIZATION, session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/users/{id}/role", creator.getId()), Map.of("role", "USUARIO"))))
                .andExpect(status().isOk());
        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/comments", event.getId()), Map.of("body", "Otro dato interno"))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/notifications").header(HttpHeaders.AUTHORIZATION, session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
        mockMvc.perform(get("/api/notifications/count/unread").header(HttpHeaders.AUTHORIZATION, session))
                .andExpect(jsonPath("$.unreadCount").value(0));
    }

    private String login(String username) throws Exception {
        String res = mockMvc.perform(json(post("/auth/login"), Map.of("username", username, "password", PASSWORD)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(res).get("accessToken").asText();
    }
}
