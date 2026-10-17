package com.mvp.backend.feature.events.controller;

import com.mvp.backend.feature.events.dto.PublicEventDto;
import com.mvp.backend.feature.events.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/public/events")
@RequiredArgsConstructor
public class PublicEventController {

    private final EventService service;

    @GetMapping
    public List<PublicEventDto> listPublicActive() {
        return service.listPublicActive();
    }
}
