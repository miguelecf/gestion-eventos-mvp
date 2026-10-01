package com.mvp.backend.feature.requests.dto;

import com.mvp.backend.feature.events.model.TechSupportMode;

/**
 * Datos que define el área administrativa al convertir una solicitud pública en evento.
 * El formulario público no captura necesidades técnicas: se deciden en la conversión (hallazgo 3.2).
 * Body opcional: si se omite, el evento no requiere soporte técnico.
 */
public record ConvertRequestToEventDto(
        Boolean requiresTech,
        TechSupportMode techSupportMode
) {
    public static final ConvertRequestToEventDto NONE = new ConvertRequestToEventDto(false, null);
}
