/**
 * ===================================================================
 * ADAPTADOR DE EVENTOS
 * ===================================================================
 * Transforma BackendEventDTO ↔ Event (modelo del frontend)
 * Maneja conversiones de fechas, prioridades y estructura de datos
 * ===================================================================
 */

import type { Event, EventStatus, EventPriority } from '@/models/event';
import type { 
  BackendEventDTO, 
  BackendCreateEventDTO, 
  BackendUpdateEventDTO,
  Priority,
  AudienceType
} from '../types/backend.types';

// ==================== MAPEO DE ENUMS ====================

// Nota: Los mapeos de prioridades legacy (BAJA/MEDIA/ALTA → LOW/MEDIUM/HIGH) 
// fueron removidos ya que ahora usamos directamente los tipos del backend.
// Si se necesita soporte para prioridades legacy, restaurar desde el historial.

// ==================== ADAPTADORES PRINCIPALES ====================

/**
 * Adapta BackendEventDTO (del backend) a Event (modelo frontend)
 * Mantiene la estructura del backend pero agrega campos de conveniencia
 * 
 * @param backendEvent - DTO recibido del backend
 * @returns Event - Modelo normalizado del frontend
 */
export function adaptEventFromBackend(backendEvent: BackendEventDTO): Event {
  return {
    // Copiar todos los campos directamente desde el backend
    id: backendEvent.id,
    date: backendEvent.date,
    technicalSchedule: backendEvent.technicalSchedule,
    scheduleFrom: backendEvent.scheduleFrom,
    scheduleTo: backendEvent.scheduleTo,
    status: backendEvent.status,
    name: backendEvent.name,
    requestingArea: backendEvent.requestingArea,
    space: backendEvent.space ? {
      id: backendEvent.space.id,
      name: backendEvent.space.name,
      capacity: backendEvent.space.capacity,
      colorHex: backendEvent.space.colorHex || '#6B7280',
      defaultBufferBeforeMin: backendEvent.bufferBeforeMin ?? 0,
      defaultBufferAfterMin: backendEvent.bufferAfterMin ?? 0,
      active: true,
    } : null,
    freeLocation: backendEvent.freeLocation,
    department: backendEvent.department ? {
      id: backendEvent.department.id,
      name: backendEvent.department.name,
      colorHex: backendEvent.department.colorHex || '#6B7280',
      active: true,
    } : null,
    requirements: backendEvent.requirements,
    coverage: backendEvent.coverage,
    observations: backendEvent.observations,
    priority: backendEvent.priority,
    audienceType: backendEvent.audienceType,
    internal: backendEvent.internal,
    ceremonialOk: backendEvent.ceremonialOk,
    technicalOk: backendEvent.technicalOk,
    requiresTech: backendEvent.requiresTech,
    techSupportMode: backendEvent.techSupportMode,
    requiresRebooking: backendEvent.requiresRebooking,
    bufferBeforeMin: backendEvent.bufferBeforeMin,
    bufferAfterMin: backendEvent.bufferAfterMin,
    contactName: backendEvent.contactName,
    contactEmail: backendEvent.contactEmail,
    contactPhone: backendEvent.contactPhone,
    createdAt: backendEvent.createdAt,
    updatedAt: backendEvent.updatedAt,
    createdBy: backendEvent.createdBy ? {
      id: backendEvent.createdBy.id,
      username: backendEvent.createdBy.username,
      name: backendEvent.createdBy.name,
      lastName: backendEvent.createdBy.lastName,
      email: backendEvent.createdBy.email
    } : null,
    lastModifiedBy: backendEvent.lastModifiedBy ? {
      id: backendEvent.lastModifiedBy.id,
      username: backendEvent.lastModifiedBy.username,
      name: backendEvent.lastModifiedBy.name,
      lastName: backendEvent.lastModifiedBy.lastName,
      email: backendEvent.lastModifiedBy.email
    } : null,
    originType: backendEvent.originType ?? null,
    originRequestId: backendEvent.originRequestId ?? null,

    // Campos adicionales de conveniencia para el frontend
    spaceId: backendEvent.space?.id,
    departmentId: backendEvent.department?.id,
    description: backendEvent.observations || undefined,
    createdOn: backendEvent.createdAt
  };
}

/**
 * Adapta múltiples eventos del backend
 * 
 * @param backendEvents - Array de DTOs del backend
 * @returns Array de modelos Event del frontend
 * 
 * @example
 * const page = await fetch('/api/events?page=0');
 * const events = adaptEventsFromBackend(page.content);
 */
export function adaptEventsFromBackend(backendEvents: BackendEventDTO[]): Event[] {
  return backendEvents.map(adaptEventFromBackend);
}

/**
 * Adapta datos del frontend para crear evento en backend
 * Transforma Event parcial → BackendCreateEventDTO
 * 
 * @param eventData - Datos del formulario de creación
 * @returns DTO listo para enviar al backend (POST /api/events)
 * 
 * @example
 * const formData = {
 *   name: 'Conferencia',
 *   date: '2025-12-01',
 *   scheduleFrom: '09:00',
 *   scheduleTo: '11:00',
 *   priority: 'ALTA',
 *   // ...
 * };
 * const dto = adaptEventForCreate(formData);
 * await httpClient.post('/api/events', dto);
 */
export function adaptEventForCreate(
  eventData: Partial<Event> & {
    name: string;
    date: string;
    scheduleFrom: string;
    scheduleTo: string;
    priority: Priority;
    audienceType?: AudienceType;
    internal: boolean;
    requiresTech: boolean;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    bufferBeforeMin?: number;
    bufferAfterMin?: number;
    spaceId?: number;
    freeLocation?: string | null;
    requestingArea?: string | null;
    techSupportMode?: 'SETUP_ONLY' | 'ATTENDED' | null;
    technicalSchedule?: string | null;
    requirements?: string | null;
    coverage?: string | null;
    observations?: string | null;
  }
): BackendCreateEventDTO {
  return {
    // Fechas y horarios (ya vienen en formato correcto: yyyy-MM-dd y HH:mm)
    date: eventData.date, // yyyy-MM-dd
    technicalSchedule: eventData.technicalSchedule || null,
    scheduleFrom: eventData.scheduleFrom, // HH:mm
    scheduleTo: eventData.scheduleTo, // HH:mm

    // Relaciones (IDs)
    spaceId: eventData.spaceId ?? null,
    freeLocation: eventData.freeLocation ?? null,
    departmentId: eventData.departmentId ?? null,

    // Datos básicos
    name: eventData.name,
    requestingArea: eventData.requestingArea ?? null,
    requirements: eventData.requirements || eventData.description || null,
    coverage: eventData.coverage || null,
    observations: eventData.observations || eventData.description || null,

    // Enums (ya vienen en formato del backend)
    priority: eventData.priority,
    audienceType: eventData.audienceType ?? null,
    internal: eventData.internal,

    // Flags técnicos
    requiresTech: eventData.requiresTech,
    techSupportMode: eventData.techSupportMode ?? null,

    // Buffers (usar valores del formulario o valores por defecto)
    bufferBeforeMin: eventData.bufferBeforeMin ?? 15,
    bufferAfterMin: eventData.bufferAfterMin ?? 15,

    // Contacto (requerido por backend)
    contactName: eventData.contactName,
    contactEmail: eventData.contactEmail,
    contactPhone: eventData.contactPhone
  };
}

/**
 * Adapta datos del frontend para actualizar evento en backend
 * Transforma Event parcial → BackendUpdateEventDTO
 * 
 * @param eventData - Datos del formulario de edición (solo campos modificados)
 * @returns DTO listo para enviar al backend (PATCH /api/events/:id)
 * 
 * @example
 * const updates = {
 *   name: 'Nuevo nombre',
 *   priority: 'ALTA'
 * };
 * const dto = adaptEventForUpdate(updates);
 * await httpClient.patch(`/api/events/${id}`, dto);
 */
type AdaptEventUpdateInput = Omit<
  Partial<Event>,
  'audienceType' | 'techSupportMode' | 'technicalSchedule' | 'spaceId' | 'departmentId'
> & {
  audienceType?: Event['audienceType'] | null;
  techSupportMode?: Event['techSupportMode'] | null;
  technicalSchedule?: string | null;
  spaceId?: number | null;
  departmentId?: number | null;
};

export function adaptEventForUpdate(
  eventData: AdaptEventUpdateInput
): BackendUpdateEventDTO {
  const updateDTO: BackendUpdateEventDTO = {};

  // Solo incluir campos definidos (no undefined)
  if (eventData.date !== undefined) {
    updateDTO.date = eventData.date; // yyyy-MM-dd
  }
  
  if (eventData.scheduleFrom !== undefined) {
    updateDTO.scheduleFrom = eventData.scheduleFrom; // HH:mm
  }
  
  if (eventData.scheduleTo !== undefined) {
    updateDTO.scheduleTo = eventData.scheduleTo; // HH:mm
  }

  if (eventData.spaceId !== undefined) {
    updateDTO.spaceId = eventData.spaceId;
  }

  if (eventData.freeLocation !== undefined) {
    updateDTO.freeLocation = eventData.freeLocation;
  }

  if (eventData.departmentId !== undefined) {
    updateDTO.departmentId = eventData.departmentId;
  }

  if (eventData.name !== undefined) {
    updateDTO.name = eventData.name;
  }

  if (eventData.requestingArea !== undefined) {
    updateDTO.requestingArea = eventData.requestingArea;
  }

  if (eventData.requirements !== undefined) {
    updateDTO.requirements = eventData.requirements;
  }

  if (eventData.coverage !== undefined) {
    updateDTO.coverage = eventData.coverage;
  }

  if (eventData.observations !== undefined) {
    updateDTO.observations = eventData.observations;
  }

  if (eventData.priority !== undefined) {
    updateDTO.priority = eventData.priority;
  }

  if (eventData.audienceType !== undefined) {
    updateDTO.audienceType = eventData.audienceType;
  }

  if (eventData.internal !== undefined) {
    updateDTO.internal = eventData.internal;
  }

  if (eventData.requiresTech !== undefined) {
    updateDTO.requiresTech = eventData.requiresTech;
  }

  if (eventData.techSupportMode !== undefined) {
    updateDTO.techSupportMode = eventData.techSupportMode;
  }

  if (eventData.technicalSchedule !== undefined) {
    updateDTO.technicalSchedule = eventData.technicalSchedule;
  }

  if (eventData.bufferBeforeMin !== undefined) {
    updateDTO.bufferBeforeMin = eventData.bufferBeforeMin;
  }

  if (eventData.bufferAfterMin !== undefined) {
    updateDTO.bufferAfterMin = eventData.bufferAfterMin;
  }

  if (eventData.contactName !== undefined) {
    updateDTO.contactName = eventData.contactName;
  }

  if (eventData.contactEmail !== undefined) {
    updateDTO.contactEmail = eventData.contactEmail;
  }

  if (eventData.contactPhone !== undefined) {
    updateDTO.contactPhone = eventData.contactPhone;
  }

  return updateDTO;
}

// ==================== HELPERS DE VALIDACIÓN ====================

/**
 * Valida si un evento es editable según su estado
 * 
 * @param event - Evento a validar
 * @returns true si el evento puede ser editado
 * 
 * @example
 * if (canEditEvent(event)) {
 *   // mostrar botón de edición
 * }
 */
export function canEditEvent(event: Event): boolean {
  return event.status === 'EN_REVISION' || event.status === 'RESERVADO';
}

/**
 * Valida si un evento puede cambiar de estado
 * 
 * @param event - Evento a validar
 * @param targetStatus - Estado destino
 * @returns true si el cambio es válido
 * 
 * @example
 * if (canChangeEventStatus(event, 'APROBADO')) {
 *   // mostrar botón de aprobar
 * }
 */
export function canChangeEventStatus(event: Event, targetStatus: EventStatus): boolean {
  const currentStatus = event.status;

  // Definir transiciones válidas
  const validTransitions: Record<EventStatus, EventStatus[]> = {
    EN_REVISION: ['RESERVADO', 'RECHAZADO'],
    RESERVADO: ['APROBADO', 'RECHAZADO'],
    APROBADO: [], // Estado final (no se puede cambiar)
    RECHAZADO: [] // Estado final (no se puede cambiar)
  };

  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

/**
 * Obtiene el color CSS asociado a un estado de evento
 * 
 * @param status - Estado del evento
 * @returns Clase CSS de color
 * 
 * @example
 * <Badge className={getEventStatusColor(event.status)}>
 *   {event.status}
 * </Badge>
 */
export function getEventStatusColor(status: EventStatus): string {
  const colorMap: Record<EventStatus, string> = {
    EN_REVISION: 'bg-yellow-100 text-yellow-800',
    RESERVADO: 'bg-purple-100 text-purple-800',
    APROBADO: 'bg-green-100 text-green-800',
    RECHAZADO: 'bg-red-100 text-red-800'
  };

  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Obtiene el color CSS asociado a una prioridad
 * 
 * @param priority - Prioridad del evento
 * @returns Clase CSS de color
 * 
 * @example
 * <Badge className={getEventPriorityColor(event.priority)}>
 *   {event.priority}
 * </Badge>
 */
export function getEventPriorityColor(priority: EventPriority): string {
  const colorMap: Record<EventPriority, string> = {
    BAJA: 'bg-gray-100 text-gray-800',
    MEDIA: 'bg-blue-100 text-blue-800',
    ALTA: 'bg-orange-100 text-orange-800',
    CRITICA: 'bg-red-100 text-red-800'
  };

  return colorMap[priority] || 'bg-gray-100 text-gray-800';
}
