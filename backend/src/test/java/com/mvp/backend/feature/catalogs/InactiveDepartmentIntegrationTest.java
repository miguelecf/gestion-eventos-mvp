package com.mvp.backend.feature.catalogs;

import com.mvp.backend.feature.catalogs.model.Department;
import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** REV-08 (RF-14): un departamento dado de baja no se asigna a eventos ni a solicitudes nuevas. */
class InactiveDepartmentIntegrationTest extends IntegrationTestBase {

    private Department inactiveDepartment() {
        Department department = newDepartment();
        department.setActive(false);
        return departmentRepository.save(department);
    }

    @Test
    void altaDeEventoConDepartamentoDadoDeBajaResponde404() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("date", LocalDate.now().plusYears(1).toString());
        body.put("scheduleFrom", "10:00");
        body.put("scheduleTo", "12:00");
        body.put("spaceId", newSpace().getId());
        body.put("departmentId", inactiveDepartment().getId());
        body.put("name", "Evento con departamento inactivo");
        body.put("priority", "MEDIUM");
        body.put("audienceType", "ESTUDIANTES");

        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events"), body)))
                .andExpect(status().isNotFound());
    }

    @Test
    void solicitudPublicaConDepartamentoDadoDeBajaResponde404() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("date", LocalDate.now().plusYears(1).toString());
        body.put("scheduleFrom", "10:00");
        body.put("scheduleTo", "12:00");
        body.put("space_id", newSpace().getId());
        body.put("requesting_department_id", inactiveDepartment().getId());
        body.put("name", "Solicitud con departamento inactivo");
        body.put("audienceType", "ESTUDIANTES");
        body.put("contactName", "Ana Solicitante");
        body.put("contactEmail", "ana@test.local");
        body.put("contactPhone", "+54 11 5555-5555");

        mockMvc.perform(json(post("/public/event-requests"), body))
                .andExpect(status().isNotFound());
    }

    @Test
    void editarUnEventoQueConservaSuDepartamentoDadoDeBajaSigueFuncionando() throws Exception {
        Department department = newDepartment();
        Event event = newEvent(Status.EN_REVISION);
        event.setDepartment(department);
        eventRepository.save(event);
        department.setActive(false);
        departmentRepository.save(department);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()),
                        Map.of("departmentId", department.getId(), "observations", "Sigue editable"))))
                .andExpect(status().isOk());
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()),
                        Map.of("departmentId", inactiveDepartment().getId()))))
                .andExpect(status().isNotFound());
    }
}
