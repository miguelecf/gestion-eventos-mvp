/**
 * ===================================================================
 * ADAPTADOR DE ESTADOS DE EVENTOS
 * ===================================================================
 * Transforma DTOs del backend a modelos del frontend
 * Maneja mapeo seguro de strings a enums
 * Consolida variantes de campos (missing/missingApprovals)
 * ===================================================================
 */

import type { 
  EventStatus, 
  EventStatusState, 
  ChangeStatusInput, 
  ChangeStatusResult 
} from '@/models/event-status';
import type {
  BackendEventStatusResponse,
  BackendChangeStatusRequest,
  BackendStatusChangeResponse,
} from '../types/backend.types';
import { KNOWN_EVENT_STATUSES, isValidEventStatus } from '@/models/event-status';

/**
 * Mapea un string del backend a EventStatus de forma segura
 * Lanza error si el valor es inválido (evita bucles infinitos)
 * 
 * @param value - String del estado desde el backend
 * @returns EventStatus válido
 * @throws Error si el estado no es reconocido
 * 
 * @example
 * mapStatusFromBackend('APROBADO') // 'APROBADO'
 * mapStatusFromBackend('UNKNOWN_STATUS') // throws Error
 */
export function mapStatusFromBackend(value: string): EventStatus {
  // ✅ FIX: Validar que value no sea null/undefined primero
  if (!value || typeof value !== 'string') {
    console.error('[Status Adapter] Estado null/undefined/inválido:', {
      value,
      type: typeof value,
    });
    throw new Error(`Estado inválido recibido del backend: ${value}`);
  }

  if (isValidEventStatus(value)) {
    return value;
  }

  // ✅ FIX: Lanzar error en lugar de fallback silencioso (evita bucles)
  console.error(`[Status Adapter] Estado desconocido: "${value}"`, {
    received: value,
    validStatuses: KNOWN_EVENT_STATUSES,
  });
  throw new Error(`Estado desconocido recibido del backend: "${value}". Estados válidos: ${KNOWN_EVENT_STATUSES.join(', ')}`);
}

/**
 * Mapea múltiples strings de estados del backend
 * Filtra valores inválidos silenciosamente (solo para listas de transiciones)
 * 
 * @param statuses - Array de strings de estados
 * @returns Array de EventStatus válidos sin duplicados
 */
export function mapStatusesFromBackend(statuses: string[]): EventStatus[] {
  if (!Array.isArray(statuses)) {
    console.warn('[Status Adapter] allowedTransitions no es array:', statuses);
    return [];
  }

  return statuses
    .filter((status) => {
      // ✅ FIX: Filtrar silenciosamente valores inválidos en listas
      if (!status || typeof status !== 'string') {
        console.warn('[Status Adapter] Transición inválida filtrada:', status);
        return false;
      }
      if (!isValidEventStatus(status)) {
        console.warn('[Status Adapter] Transición desconocida filtrada:', status);
        return false;
      }
      return true;
    })
    .map((status) => status as EventStatus)
    .filter((status, index, self) => self.indexOf(status) === index); // Eliminar duplicados
}

/**
 * Adapta la respuesta de GET /api/events/{id}/status
 * 
 * @param dto - Response del backend
 * @returns EventStatusState normalizado
 * @throws Error si el DTO es inválido o falta información crítica
 * 
 * @example
 * const dto = { eventId: 1, current: 'EN_REVISION', allowed: ['RESERVADO'] };
 * const state = adaptEventStatusFromBackend(dto);
 * // state.currentStatus === 'EN_REVISION'
 * // state.allowedTransitions === ['RESERVADO']
 */
export function adaptEventStatusFromBackend(
  dto: BackendEventStatusResponse
): EventStatusState {
  // ✅ FIX: Validación estricta del DTO
  if (!dto) {
    console.error('[Status Adapter] DTO es null/undefined');
    throw new Error('Respuesta de estado del evento es inválida (null/undefined)');
  }

  if (!dto.eventId) {
    console.error('[Status Adapter] DTO sin eventId:', dto);
    throw new Error('Respuesta de estado sin eventId');
  }

  const currentStatusValue = dto.current;
  const allowedTransitionsValue = dto.allowed;

  if (!currentStatusValue) {
    console.error('[Status Adapter] DTO sin campo current:', dto);
    throw new Error('Respuesta de estado sin campo de estado. Posiblemente el usuario no tiene permisos para ver el estado del evento.');
  }

  // ✅ Log de datos válidos para debugging
  console.log('[Status Adapter] Adaptando estado:', {
    eventId: dto.eventId,
    currentStatusValue,
    allowedTransitionsValue,
    raw: { current: dto.current, allowed: dto.allowed }
  });

  return {
    eventId: dto.eventId,
    currentStatus: mapStatusFromBackend(currentStatusValue),
    allowedTransitions: mapStatusesFromBackend(allowedTransitionsValue || []),
  };
}

/**
 * Adapta el input del frontend para POST /api/events/{id}/status
 * 
 * @param input - Datos del cambio de estado desde la UI
 * @returns DTO para enviar al backend
 * 
 * @example
 * const input = { to: 'APROBADO', reason: 'Todo OK' };
 * const dto = adaptChangeStatusForBackend(input);
 * // dto = { to: 'APROBADO', reason: 'Todo OK', note: null }
 */
export function adaptChangeStatusForBackend(
  input: ChangeStatusInput
): BackendChangeStatusRequest {
  return {
    to: input.to,
    reason: input.reason || null,
    note: input.note || null,
  };
}

/**
 * Adapta la respuesta de POST /api/events/{id}/status
 * Normaliza la respuesta del backend para el modelo de la interfaz
 * 
 * @param dto - Response del backend después del cambio
 * @returns ChangeStatusResult normalizado
 * 
 * @example
 * const dto = { 
 *   eventId: 1, 
 *   status: 'APROBADO', 
 *   approvalPending: false,
 *   missing: [] 
 * };
 * const result = adaptChangeStatusFromBackend(dto);
 * // result.newStatus === 'APROBADO'
 * // result.approvalPending === false
 */
export function adaptChangeStatusFromBackend(
  dto: BackendStatusChangeResponse
): ChangeStatusResult {
  const statusValue = dto.status;
  
  if (!statusValue) {
    console.error('[Status Adapter] Response sin campo de estado:', dto);
    throw new Error('Respuesta de cambio de estado sin campo status');
  }

  const missingApprovals = dto.missing;

  return {
    eventId: dto.eventId,
    newStatus: mapStatusFromBackend(statusValue),
    approvalPending: dto.approvalPending ?? false,
    missingApprovals: missingApprovals,
  };
}

/**
 * Valida si una transición de estado es permitida
 * 
 * @param from - Estado actual
 * @param to - Estado destino
 * @param allowedTransitions - Transiciones permitidas desde el backend
 * @returns true si la transición es válida
 * 
 * @example
 * const allowed = ['RESERVADO', 'RECHAZADO'];
 * isTransitionAllowed('EN_REVISION', 'RESERVADO', allowed) // true
 * isTransitionAllowed('EN_REVISION', 'APROBADO', allowed) // false
 */
export function isTransitionAllowed(
  _from: EventStatus,
  to: EventStatus,
  allowedTransitions: EventStatus[]
): boolean {
  return allowedTransitions.includes(to);
}

/**
 * Valida si un cambio de estado requiere motivo
 * Solo RECHAZADO requiere motivo obligatorio
 * 
 * @param to - Estado destino
 * @returns true si requiere motivo
 * 
 * @example
 * requiresReason('RECHAZADO') // true
 * requiresReason('APROBADO') // false
 */
export function requiresReason(to: EventStatus): boolean {
  return to === 'RECHAZADO';
}

/**
 * Obtiene un mensaje descriptivo para una transición
 * 
 * @param from - Estado actual
 * @param to - Estado destino
 * @returns Mensaje descriptivo
 * 
 * @example
 * getTransitionMessage('EN_REVISION', 'APROBADO')
 * // "¿Confirmar aprobación del evento?"
 */
export function getTransitionMessage(from: EventStatus, to: EventStatus): string {
  void from;
  const messages: Partial<Record<EventStatus, string>> = {
    APROBADO: '¿Confirmar aprobación del evento?',
    RECHAZADO: '¿Rechazar este evento? Debe proporcionar un motivo.',
    RESERVADO: '¿Reservar espacio y recursos para este evento?',
    EN_REVISION: '¿Enviar el evento a revisión?',
  };

  return messages[to] || `¿Cambiar estado a ${to}?`;
}
