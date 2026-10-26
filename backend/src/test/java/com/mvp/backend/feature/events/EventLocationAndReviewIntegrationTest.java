package com.mvp.backend.feature.events;

import com.mvp.backend.feature.events.model.Event;
import com.mvp.backend.feature.events.model.Status;
import com.mvp.backend.support.IntegrationTestBase;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hallazgos 2.9 (cambio espacio ↔ ubicación libre) y 3.7 (cambios que invalidan la revisión).
 * REV-03: la vuelta a revisión reinicia las dos conformidades (RN-05 del TFI).
 * REV-13: la ubicación nunca queda vacía y un espacio dado de baja no bloquea a sus eventos.
 */
class EventLocationAndReviewIntegrationTest extends IntegrationTestBase {

    private Event reload(Event e) {
        return eventRepository.findById(e.getId()).orElseThrow();
    }

    @Test
    void espacioAUbicacionLibre() throws Exception {
        Event event = newEvent(Status.EN_REVISION);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("freeLocation", "Patio central"))))
                .andExpect(status().isOk());

        Event after = reload(event);
        assertThat(after.getSpace()).isNull();
        assertThat(after.getFreeLocation()).isEqualTo("Patio central");
    }

    @Test
    void ubicacionLibreAEspacio() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        event.setSpace(null);
        event.setFreeLocation("Patio central");
        eventRepository.save(event);
        Long spaceId = newSpace().getId();

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("spaceId", spaceId))))
                .andExpect(status().isOk());

        Event after = reload(event);
        assertThat(after.getSpace().getId()).isEqualTo(spaceId);
        assertThat(after.getFreeLocation()).isNull();
    }

    @Test
    void ambasUbicacionesALaVezSigueSiendoInvalido() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()),
                        Map.of("spaceId", newSpace().getId(), "freeLocation", "Patio"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cambiarBuffersDeUnEventoAprobadoLoDevuelveARevisionYSeAudita() throws Exception {
        Event event = newEvent(Status.APROBADO);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("bufferBeforeMin", 30))))
                .andExpect(status().isOk());

        assertThat(reload(event).getStatus()).isEqualTo(Status.EN_REVISION);
        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/audit/{id}", event.getId())))
                .andExpect(jsonPath("$.entries[?(@.type == 'FIELD_UPDATE' && @.field == 'buffers')]").value(hasSize(1)));
    }

    @Test
    void cambiarTextoDeUbicacionLibreDeUnEventoReservadoLoDevuelveARevision() throws Exception {
        Event event = newEvent(Status.RESERVADO);
        event.setSpace(null);
        event.setFreeLocation("Patio central");
        eventRepository.save(event);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("freeLocation", "Aula magna"))))
                .andExpect(status().isOk());

        assertThat(reload(event).getStatus()).isEqualTo(Status.EN_REVISION);
    }

    @Test
    void volverARevisionPorUnCambioRelevanteReiniciaLasConformidades() throws Exception {
        Event event = newEvent(Status.APROBADO);
        event.setCeremonialOk(true);
        event.setTechnicalOk(true);
        eventRepository.save(event);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("scheduleTo", "13:00"))))
                .andExpect(status().isOk());

        Event after = reload(event);
        assertThat(after.getStatus()).isEqualTo(Status.EN_REVISION);
        assertThat(after.isCeremonialOk()).isFalse();
        assertThat(after.isTechnicalOk()).isFalse();
        mockMvc.perform(as(Role.ADMIN_FULL, get("/api/audit/{id}", event.getId())))
                .andExpect(jsonPath("$.entries[?(@.type == 'FIELD_UPDATE' && @.field == 'ceremonial_ok')]").value(hasSize(1)))
                .andExpect(jsonPath("$.entries[?(@.type == 'FIELD_UPDATE' && @.field == 'technical_ok')]").value(hasSize(1)));
    }

    @Test
    void unCambioSinImpactoEnLaPlanificacionConservaLasConformidades() throws Exception {
        Event event = newEvent(Status.APROBADO);
        event.setCeremonialOk(true);
        event.setTechnicalOk(true);
        eventRepository.save(event);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("observations", "Llevar banderas"))))
                .andExpect(status().isOk());

        Event after = reload(event);
        assertThat(after.getStatus()).isEqualTo(Status.APROBADO);
        assertThat(after.isCeremonialOk()).isTrue();
        assertThat(after.isTechnicalOk()).isTrue();
    }

    @Test
    void unaUbicacionLibreEnBlancoNoBorraElEspacio() throws Exception {
        Event event = newEvent(Status.APROBADO);
        Long spaceId = event.getSpace().getId();

        for (String blank : new String[]{"", "   "}) {
            mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("freeLocation", blank))))
                    .andExpect(status().isOk());
            Event after = reload(event);
            assertThat(after.getSpace()).isNotNull();
            assertThat(after.getSpace().getId()).isEqualTo(spaceId);
            assertThat(after.getFreeLocation()).isNull();
        }
    }

    @Test
    void unEventoCuyoEspacioSeDioDeBajaSigueEditable() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        var space = event.getSpace();
        space.setActive(false);
        spaceRepository.save(space);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("name", "Nombre nuevo"))))
                .andExpect(status().isOk());
        mockMvc.perform(as(Role.ADMIN_FULL, json(post("/api/events/{id}/status", event.getId()), Map.of("to", "RESERVADO"))))
                .andExpect(status().isOk());
        // Asignarlo a otro evento sí está prohibido.
        Event other = newEvent(Status.EN_REVISION);
        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", other.getId()), Map.of("spaceId", space.getId()))))
                .andExpect(status().isNotFound());
    }

    @Test
    void unEventoDadoDeBajaNoSeEdita() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        mockMvc.perform(as(Role.ADMIN_FULL, patch("/api/events/{id}/soft-delete", event.getId())))
                .andExpect(status().isNoContent());

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("name", "Editado"))))
                .andExpect(status().isBadRequest());
        assertThat(reload(event).getName()).isNotEqualTo("Editado");
    }

    @Test
    void unaConformidadParcialSePierdeSiCambiaLaAgendaEnRevision() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        event.setCeremonialOk(true);
        eventRepository.save(event);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()), Map.of("scheduleFrom", "09:00"))))
                .andExpect(status().isOk());
        assertThat(reload(event).isCeremonialOk()).isFalse();

        // Técnica sola ya no alcanza para aprobar la agenda nueva.
        mockMvc.perform(as(Role.ADMIN_TECNICA, json(post("/api/events/{id}/status", event.getId()), Map.of("to", "APROBADO"))))
                .andExpect(status().isAccepted());
        assertThat(reload(event).getStatus()).isEqualTo(Status.EN_REVISION);
    }

    @Test
    void reenviarElEspacioActualDadoDeBajaSeAdmite() throws Exception {
        Event event = newEvent(Status.EN_REVISION);
        var space = event.getSpace();
        space.setActive(false);
        spaceRepository.save(space);

        mockMvc.perform(as(Role.ADMIN_FULL, json(patch("/api/events/{id}", event.getId()),
                        Map.of("spaceId", space.getId(), "name", "Formulario completo"))))
                .andExpect(status().isOk());
    }
}
