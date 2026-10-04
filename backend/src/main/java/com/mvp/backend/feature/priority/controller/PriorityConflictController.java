package com.mvp.backend.feature.priority.controller;

import com.mvp.backend.feature.priority.dto.PriorityConflictDecisionRequest;
import com.mvp.backend.feature.priority.dto.PriorityConflictDecisionResponse;
import com.mvp.backend.feature.priority.dto.PriorityConflictResponse;
import com.mvp.backend.feature.priority.service.PriorityConflictService;
import com.mvp.backend.feature.priority.dto.PendingPriorityConflictResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/priority")
@RequiredArgsConstructor
public class PriorityConflictController {

    private final PriorityConflictService priorityConflictService;

    @GetMapping("/conflicts")
    public PriorityConflictResponse getOpenConflicts(@RequestParam Long eventId) {
        return priorityConflictService.getOpenConflictsResponse(eventId);
    }

    @GetMapping("/conflicts/pending")
    public Page<PendingPriorityConflictResponse> getAllPendingConflicts(
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return priorityConflictService.getAllOpenConflictsResponse(pageable);
    }

    @PostMapping("/decisions")
    @ResponseStatus(HttpStatus.CREATED)
    public PriorityConflictDecisionResponse decide(@Valid @RequestBody PriorityConflictDecisionRequest request) {
        return priorityConflictService.applyDecisionResponse(request);
    }
}
