package com.mvp.backend.feature.priority.model;

public enum PriorityConflictDecision {
    /** Reprograma el evento desplazado a la agenda indicada en {@code target}. */
    REBOOK_OTHER,
    /** Mantiene la agenda actual del evento desplazado y limpia la marca de reprogramación. */
    KEEP_ORIGINAL
}