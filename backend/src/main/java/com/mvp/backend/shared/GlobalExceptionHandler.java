package com.mvp.backend.shared;

import com.mvp.backend.feature.auth.exception.EmailDeliveryException;
import com.mvp.backend.feature.availability.exception.AvailabilityConflictException;
import com.mvp.backend.feature.availability.service.AvailabilityMapper;
import com.mvp.backend.feature.tech.exception.TechCapacityExceededException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@lombok.RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final AvailabilityMapper availabilityMapper;

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Validation failed");
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage, (a, b) -> a,
                        LinkedHashMap::new));
        body.put("errors", errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleEntityNotFound(EntityNotFoundException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(DataIntegrityViolationException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Entity already exists");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(TechCapacityExceededException.class)
    public ResponseEntity<Map<String, Object>> handleTechCapacity(TechCapacityExceededException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "TECH_CAPACITY_REACHED");
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(AvailabilityConflictException.class)
    public ResponseEntity<Object> handleAvailabilityConflict(AvailabilityConflictException ex) {
        // Reusar los mismos DTOs que los endpoints de disponibilidad para mantener
        // formato consistente.
        Object body = ex.isPublicView()
                ? availabilityMapper.toPublicResponse(ex.getResult())
                : availabilityMapper.toInternalResponse(ex.getResult());

        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(DomainValidationException.class)
    public ResponseEntity<Map<String, Object>> handleDomainValidation(DomainValidationException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "DOMAIN_VALIDATION_ERROR");
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "CONCURRENT_MODIFICATION");
        body.put("message", "El registro cambió mientras se guardaba. Volvé a cargarlo y repetí la operación.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    /** Deadlock o espera de bloqueo vencida en la base: la operación se revirtió entera y se puede repetir. */
    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> handleLockFailure(PessimisticLockingFailureException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "CONCURRENT_MODIFICATION");
        body.put("message", "Otra operación estaba modificando el mismo registro. Repetí la operación.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(EmailDeliveryException.class)
    public ResponseEntity<Map<String, Object>> handleEmailDelivery(EmailDeliveryException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "EMAIL_DELIVERY_FAILED");
        body.put("message", ex.getMessage());
        body.put("details", "La operación fue revertida para evitar usuarios sin credenciales enviadas.");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }
}