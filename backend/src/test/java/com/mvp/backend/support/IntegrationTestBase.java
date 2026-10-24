package com.mvp.backend.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mvp.backend.feature.catalogs.model.Department;
import com.mvp.backend.feature.catalogs.model.Space;
import com.mvp.backend.feature.catalogs.repository.DepartmentRepository;
import com.mvp.backend.feature.catalogs.repository.SpaceRepository;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.feature.events.repository.EventRepository;
import com.mvp.backend.feature.priority.model.PriorityConflict;
import com.mvp.backend.feature.priority.model.PriorityConflictStatus;
import com.mvp.backend.feature.priority.repository.PriorityConflictRepository;
import com.mvp.backend.feature.requests.model.EventRequest;
import com.mvp.backend.feature.requests.repository.EventRequestRepository;
import com.mvp.backend.feature.users.model.User;
import com.mvp.backend.feature.users.repository.UserRepository;
import com.mvp.backend.shared.Priority;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Base para tests de integración HTTP.
 * Perfil "test": H2 en memoria, sin Flyway ni seeds; cada test arma sus propios datos.
 * Uso: {@code mockMvc.perform(as(Role.USUARIO, get("/api/events")))}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTestBase {

    public enum Role { ADMIN_FULL, ADMIN_CEREMONIAL, ADMIN_TECNICA, USUARIO }

    protected static final String PASSWORD = "Test1234!";

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected UserRepository userRepository;
    @Autowired protected SpaceRepository spaceRepository;
    @Autowired protected DepartmentRepository departmentRepository;
    @Autowired protected PasswordEncoder passwordEncoder;
    @Autowired protected EventRepository eventRepository;
    @Autowired protected EventRequestRepository eventRequestRepository;
    @Autowired protected PriorityConflictRepository priorityConflictRepository;

    private final Map<Role, String> tokens = new EnumMap<>(Role.class);

    /** Usuario de prueba por rol (idempotente; se comparte entre tests del mismo contexto). */
    protected User user(Role role) {
        String username = "it." + role.name().toLowerCase();
        return userRepository.findByUsername(username).orElseGet(() -> userRepository.save(User.builder()
                .username(username)
                .name("Test")
                .lastName(role.name())
                .email(username + "@test.local")
                .password(passwordEncoder.encode(PASSWORD))
                .priority(Priority.MEDIUM)
                .role(role.name())
                .mustChangePassword(false)
                .build()));
    }

    /** JWT real obtenido vía POST /auth/login. */
    protected String token(Role role) throws Exception {
        String cached = tokens.get(role);
        if (cached != null) {
            return cached;
        }
        User u = user(role);
        String body = objectMapper.writeValueAsString(Map.of("username", u.getUsername(), "password", PASSWORD));
        String response = mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(response);
        String accessToken = json.get("accessToken").asText();
        tokens.put(role, accessToken);
        return accessToken;
    }

    /** Agrega el header Authorization del rol indicado al request. */
    protected MockHttpServletRequestBuilder as(Role role, MockHttpServletRequestBuilder request) throws Exception {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(role));
    }

    protected MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
    }

    protected Space newSpace() {
        return spaceRepository.save(Space.builder()
                .name("Espacio " + UUID.randomUUID().toString().substring(0, 8))
                .capacity(100)
                .build());
    }

    protected Department newDepartment() {
        return departmentRepository.save(Department.builder()
                .name("Depto " + UUID.randomUUID().toString().substring(0, 8))
                .build());
    }

    /**
     * Evento persistido directamente (sin pasar por reglas de servicio) en un espacio propio,
     * para no colisionar con otros tests. Fecha lejana para evitar conflictos de agenda.
     */
    protected Event newEvent(Status status) {
        return eventRepository.save(Event.builder()
                .name("Evento IT " + UUID.randomUUID().toString().substring(0, 8))
                .date(LocalDate.now().plusYears(1))
                .scheduleFrom(LocalTime.of(10, 0))
                .scheduleTo(LocalTime.of(12, 0))
                .status(status)
                .priority(Priority.MEDIUM)
                .space(newSpace())
                .createdBy(user(Role.ADMIN_FULL))
                .build());
    }

    /** Conflicto de prioridad abierto entre dos eventos reservados, persistido directamente. */
    protected PriorityConflict newPriorityConflict() {
        Event high = newEvent(Status.RESERVADO);
        Event displaced = newEvent(Status.RESERVADO);
        return priorityConflictRepository.save(PriorityConflict.builder()
                .conflictCode("IT-" + UUID.randomUUID().toString().substring(0, 8))
                .highEvent(high)
                .displacedEvent(displaced)
                .spaceId(displaced.getSpace().getId())
                .date(displaced.getDate())
                .fromTime(displaced.getScheduleFrom())
                .toTime(displaced.getScheduleTo())
                .status(PriorityConflictStatus.OPEN)
                .createdBy(user(Role.ADMIN_FULL))
                .build());
    }

    /** Crea una solicitud por el endpoint público (sin login) y la devuelve persistida. */
    protected EventRequest createPublicRequest() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("date", LocalDate.now().plusYears(1).toString());
        body.put("scheduleFrom", "10:00");
        body.put("scheduleTo", "12:00");
        body.put("space_id", newSpace().getId());
        body.put("name", "Solicitud IT " + UUID.randomUUID().toString().substring(0, 8));
        body.put("priority", "MEDIUM");
        body.put("audienceType", "ESTUDIANTES");
        body.put("contactName", "Ana Solicitante");
        body.put("contactEmail", "ana@test.local");
        body.put("contactPhone", "+54 11 5555-5555");
        body.put("bufferBeforeMin", 0);
        body.put("bufferAfterMin", 0);
        String res = mockMvc.perform(json(post("/public/event-requests"), body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String uuid = objectMapper.readTree(res).get("tracking_uuid").asText();
        return eventRequestRepository.findByTrackingUuid(uuid).orElseThrow();
    }
}
