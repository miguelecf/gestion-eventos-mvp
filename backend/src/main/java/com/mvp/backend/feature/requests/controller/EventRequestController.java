package com.mvp.backend.feature.requests.controller;

import com.mvp.backend.feature.requests.dto.CreateEventRequestDto;
import com.mvp.backend.feature.requests.dto.EventRequestCreatedDto;
import com.mvp.backend.feature.requests.service.EventRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/public/event-requests")
@RequiredArgsConstructor
public class EventRequestController {

    private final EventRequestService eventRequestService;

    @PostMapping
    public ResponseEntity<EventRequestCreatedDto> create(@Valid @RequestBody CreateEventRequestDto requestDto) {
        EventRequestCreatedDto created = eventRequestService.create(requestDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
