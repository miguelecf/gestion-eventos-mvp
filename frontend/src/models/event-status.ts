/**
 * ===================================================================
 * MODELOS DE ESTADO DE EVENTOS
 * ===================================================================
 * Define los estados posibles de un evento y sus transiciones
 * Alineado con el backend Spring Boot
 * ===================================================================
 */

/**
 * Estados posibles de un evento
 * Re-exportamos del backend para mantener consistencia
 */
export type EventStatus =
  | 'EN_REVISION'
  | 'RESERVADO'
  | 'APROBADO'
  | 'RECHAZADO';

/**
 * Array con todos los estados conocidos
 * Usado para validación y mapeo seguro
 */
export const KNOWN_EVENT_STATUSES: readonly EventStatus[] = [
  'EN_REVISION',
  'RESERVADO',
  'APROBADO',
  'RECHAZADO',
] as const;

/**
 * Estado actual del evento con transiciones permitidas
 * Modelo del frontend normalizado
 */
export interface EventStatusState {
  eventId: number;
  currentStatus: EventStatus;
  allowedTransitions: EventStatus[];
}

/**
 * Datos para cambiar el estado de un evento
 * Input del usuario desde la UI
 */
export interface ChangeStatusInput {
  to: EventStatus;
  reason?: string;
  note?: string;
}

/**
 * Resultado del cambio de estado
 * Incluye información de aprobaciones pendientes para flujos complejos
 */
export interface ChangeStatusResult {
  eventId: number;
  newStatus: EventStatus;
  approvalPending: boolean;
  missingApprovals: string[];
}

/**
 * Metadata adicional de un estado
 * Útil para UI (colores, descripciones, etc.)
 */
export interface EventStatusMetadata {
  status: EventStatus;
  label: string;
  description: string;
  color: 'default' | 'secondary' | 'destructive' | 'outline';
  icon?: string;
}

/**
 * Mapeo de estados a metadata para UI
 */
export const EVENT_STATUS_METADATA: Record<EventStatus, EventStatusMetadata> = {
  EN_REVISION: {
    status: 'EN_REVISION',
    label: 'En Revisión',
    description: 'El evento está siendo revisado por el área correspondiente',
    color: 'outline',
    icon: 'search',
  },
  RESERVADO: {
    status: 'RESERVADO',
    label: 'Reservado',
    description: 'El espacio y recursos han sido reservados',
    color: 'default',
    icon: 'bookmark',
  },
  APROBADO: {
    status: 'APROBADO',
    label: 'Aprobado',
    description: 'El evento ha sido aprobado y está confirmado',
    color: 'default',
    icon: 'check-circle',
  },
  RECHAZADO: {
    status: 'RECHAZADO',
    label: 'Rechazado',
    description: 'El evento ha sido rechazado',
    color: 'destructive',
    icon: 'x-circle',
  },
};

/**
 * Helper para validar si un string es un estado válido
 * 
 * @param status - String a validar
 * @returns true si es un EventStatus válido
 * 
 * @example
 * if (isValidEventStatus('APROBADO')) {
 *   // usar como EventStatus
 * }
 */
export function isValidEventStatus(status: string): status is EventStatus {
  return KNOWN_EVENT_STATUSES.includes(status as EventStatus);
}

/**
 * Helper para obtener metadata de un estado
 * 
 * @param status - Estado del evento
 * @returns Metadata del estado
 * 
 * @example
 * const meta = getStatusMetadata('APROBADO');
 * console.log(meta.label); // "Aprobado"
 * console.log(meta.color); // "default"
 */
export function getStatusMetadata(status: EventStatus): EventStatusMetadata {
  return EVENT_STATUS_METADATA[status];
}
