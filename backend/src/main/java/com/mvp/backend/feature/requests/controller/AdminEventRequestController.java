package com.mvp.backend.feature.requests.controller;

import com.mvp.backend.feature.requests.dto.ConvertRequestToEventDto;
import com.mvp.backend.feature.events.dto.EventResponseDto;
import com.mvp.backend.feature.requests.dto.ChangeRequestStatusDto;
import com.mvp.backend.feature.requests.dto.EventRequestResponseDto;
import com.mvp.backend.feature.requests.service.EventRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/event-requests")
@RequiredArgsConstructor
public class AdminEventRequestController {

    private final EventRequestService eventRequestService;

    /**
     * Detalle completo de una solicitud para gestión interna.
     */
    @GetMapping("/{id}")
    public ResponseEntity<EventRequestResponseDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(eventRequestService.getAdminById(id));
    }

    /**
     * Mueve la solicitud entre estados: RECIBIDO↔EN_REVISION, cualquiera→RECHAZADO.
     * La conversión a CONVERTIDO se resuelve en /convert-to-event.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<EventRequestResponseDto> changeStatus(
            @PathVariable Long id,
            @Valid @RequestBody ChangeRequestStatusDto dto) {
        return ResponseEntity.ok(eventRequestService.changeStatus(id, dto));
    }

    /**
     * Convierte la solicitud en un Event con estado EN_REVISION.
     * Body opcional: {@code {requiresTech, techSupportMode}}; sin body el evento no requiere soporte técnico.
     */
    @PostMapping("/{id}/convert-to-event")
    public ResponseEntity<EventResponseDto> convertToEvent(
            @PathVariable Long id,
            @RequestBody(required = false) ConvertRequestToEventDto body) {
        return ResponseEntity.ok(eventRequestService.convertToEvent(id,
                body != null ? body : ConvertRequestToEventDto.NONE));
    }
}
