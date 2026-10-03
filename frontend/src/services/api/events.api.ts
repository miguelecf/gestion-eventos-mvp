/**
 * ===================================================================
 * SDK DE EVENTOS - API DE ALTO NIVEL
 * ===================================================================
 * Proporciona funciones de alto nivel para gestionar eventos.
 * Integra httpClient + adaptadores + manejo de errores.
 * ===================================================================
 */

import { httpClient } from './client';
import { ENDPOINTS } from './client/config';
import type { 
  BackendEventDTO, 
  BackendEventCreateResult,
  BackendEventUpdateResult,
  BackendStatusChangeResponse,
  BackendSpaceAvailabilityResponse,
  EventStatus
} from './types/backend.types';
import type { SpringPageResponse, PageResponse } from './types/pagination.types';
import {
  adaptEventFromBackend,
  adaptEventsFromBackend,
  adaptEventForCreate,
  adaptEventForUpdate
} from './adapters';
import { adaptSpringPage, adaptArrayToPage, buildPaginationQuery } from './adapters/pagination.adapter';
import type { Event, EventFilters } from '@/models/event';

// ==================== TIPOS ESPECÍFICOS DEL SDK ====================

/**
 * Parámetros de consulta para listar eventos
 */
export interface EventsQueryParams {
  page?: number;
  size?: number;
  sort?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
  filters?: EventFilters;
}

/**
 * Input para crear un evento (tipo alias para Event parcial)
 */
export type CreateEventInput = Partial<Event> & {
  name: string;
  date: string;
  scheduleFrom: string;
  scheduleTo: string;
  priority: Event['priority'];
  internal: boolean;
  requiresTech: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  audienceType?: Event['audienceType'];
};

/**
 * Input para actualizar un evento (tipo alias para Event parcial)
 */
export type UpdateEventInput = Partial<Omit<Event, 'id' | 'createdBy' | 'createdAt'>>;
export type EventUpdatePatchInput = Omit<
  UpdateEventInput,
  'audienceType' | 'techSupportMode' | 'technicalSchedule' | 'spaceId' | 'departmentId'
> & {
  audienceType?: Event['audienceType'] | null;
  techSupportMode?: Event['techSupportMode'] | null;
  technicalSchedule?: string | null;
  spaceId?: number | null;
  departmentId?: number | null;
};

/**
 * Parámetros para cambiar el estado de un evento
 */
export interface ChangeStatusInput {
  newStatus: EventStatus;
  reason?: string;
}

/**
 * Parámetros para verificar disponibilidad de espacio
 */
export interface AvailabilityCheckParams {
  spaceId: number;
  date: string; // yyyy-MM-dd
  scheduleFrom: string; // HH:mm
  scheduleTo: string; // HH:mm
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  excludeEventId?: number; // Para excluir evento actual al editar
}

/**
 * Parámetros para obtener eventos del calendario
 */
export interface CalendarEventsParams {
  startDate: string;
  endDate: string;
  spaceIds?: number[];
}

/**
 * Respuesta de disponibilidad adaptada
 */
export interface AvailabilityResponse {
  available: boolean;
  conflicts: Array<{
    eventId: number;
    eventName: string;
    from: string;
    to: string;
    status?: string;
    priority?: string;
    bufferBefore?: number;
    bufferAfter?: number;
  }>;
}

// ==================== FUNCIONES DEL SDK ====================

/**
 * Obtiene una página de eventos con filtros y paginación
 * 
 * @param params - Parámetros de consulta (paginación + filtros)
 * @returns Página de eventos adaptados al modelo del frontend
 * 
 * @example
 * const page = await eventsApi.getEvents({
 *   page: 0,
 *   size: 20,
 *   sort: [{ field: 'date', direction: 'DESC' }],
 *   filters: {
 *     status: ['EN_REVISION', 'RESERVADO'],
 *     startDate: '2025-01-01',
 *     endDate: '2025-12-31'
 *   }
 * });
 */
export async function getEvents(params: EventsQueryParams = {}): Promise<PageResponse<Event>> {
  
  // 1. Construir query params de paginación
  const paginationQuery = buildPaginationQuery(params);

  // 2. GET /api/events sólo soporta paginación y orden (page, size, sort).
  //    Los filtros de la UI (búsqueda, estado, fechas, internal) se aplican en el cliente
  //    sobre el conjunto activo; no se envían parámetros que el backend ignoraría (hallazgo 2.3).

  // 3. Hacer request al backend
  // El backend ahora detecta automáticamente:
  // - Con page/size params -> devuelve Page<EventResponseDto>
  // - Sin params -> devuelve List<EventResponseDto>
  const response = await httpClient.get<SpringPageResponse<BackendEventDTO> | BackendEventDTO[]>(
    `${ENDPOINTS.EVENTS}?${paginationQuery.toString()}`
  );

  // 4. Detectar si la respuesta es un array o un objeto paginado
  if (Array.isArray(response)) {
    // Backend devolvió List (sin params de paginación) - para calendario
    return adaptArrayToPage(
      response,
      adaptEventFromBackend,
      params.page || 0,
      params.size || 20
    );
  } else {
    // Backend devolvió Page (con params de paginación) - para listado
    return adaptSpringPage(response, adaptEventFromBackend);
  }
}

/**
 * Obtiene un evento por su ID
 * 
 * @param eventId - ID del evento
 * @returns Evento adaptado al modelo del frontend
 * 
 * @throws {ApiError} Si el evento no existe (404)
 * 
 * @example
 * const event = await eventsApi.getEventById(123);
 * console.log(event.name); // "Conferencia 2025"
 */
export async function getEventById(eventId: number): Promise<Event> {
  // ✅ DEBUG: Log para confirmar la llamada por ID
  console.log('🎯 [eventsApi.getEventById] Llamando a GET /api/events/' + eventId);
  
  const backendEvent = await httpClient.get<BackendEventDTO>(
    ENDPOINTS.EVENT_BY_ID(eventId)
  );

  console.log('✅ [eventsApi.getEventById] Evento recibido:', backendEvent.id);
  return adaptEventFromBackend(backendEvent);
}

/**
 * Crea un nuevo evento
 * 
 * @param eventData - Datos del evento a crear
 * @returns Evento creado y adaptado
 * 
 * @throws {ApiError} Si hay errores de validación (400)
 * 
 * @example
 * const newEvent = await eventsApi.createEvent({
 *   name: 'Conferencia 2025',
 *   date: '2025-12-01',
 *   scheduleFrom: '09:00',
 *   scheduleTo: '11:00',
 *   priority: 'HIGH',
 *   audienceType: 'ESTUDIANTES',
 *   internal: false,
 *   requiresTech: true,
 *   contactName: 'Juan Pérez',
 *   contactEmail: 'juan@example.com',
 *   contactPhone: '+54 9 11 1234-5678'
 * });
 */
export async function createEvent(
  eventData: CreateEventInput
): Promise<Event> {
  // 1. Adaptar datos del frontend al formato del backend
  const createDTO = adaptEventForCreate(eventData);

  // 2. Enviar al backend
  const createdEvent = await httpClient.post<BackendEventCreateResult>(
    ENDPOINTS.EVENTS,
    createDTO
  );

  // 3. Pedir el evento completo usando el ID retornado por la mutación
  const backendEvent = await httpClient.get<BackendEventDTO>(
    ENDPOINTS.EVENT_BY_ID(createdEvent.eventId)
  );

  return adaptEventFromBackend(backendEvent);
}

/**
 * Actualiza un evento existente
 * Solo envía los campos que fueron modificados
 * 
 * @param eventId - ID del evento a actualizar
 * @param updates - Campos a actualizar (solo los modificados)
 * @returns Evento actualizado y adaptado
 * 
 * @throws {ApiError} Si el evento no existe (404) o no es editable (400)
 * 
 * @example
 * const updated = await eventsApi.updateEvent(123, {
 *   name: 'Nuevo nombre',
 *   priority: 'HIGH'
 * });
 */
export async function updateEvent(
  eventId: number,
  updates: EventUpdatePatchInput
): Promise<Event> {
  // 1. Adaptar solo los campos modificados
  const updateDTO = adaptEventForUpdate(updates);

  // 2. Enviar al backend
  const updatedEvent = await httpClient.patch<BackendEventUpdateResult>(
    ENDPOINTS.EVENT_BY_ID(eventId),
    updateDTO
  );

  // 3. Leer el evento completo ya actualizado
  const backendEvent = await httpClient.get<BackendEventDTO>(
    ENDPOINTS.EVENT_BY_ID(updatedEvent.eventId)
  );

  return adaptEventFromBackend(backendEvent);
}

/**
 * Da de baja (soft-delete) un evento: PATCH /api/events/{id}/soft-delete
 * 
 * @param eventId - ID del evento a dar de baja
 * 
 * @throws {ApiError} Si el evento no existe (404) o no puede eliminarse (400)
 * 
 * @example
 * await eventsApi.deleteEvent(123);
 */
export async function deleteEvent(eventId: number): Promise<void> {
  await httpClient.patch(ENDPOINTS.EVENT_SOFT_DELETE(eventId));
}

/**
 * Cambia el estado de un evento
 * 
 * @param eventId - ID del evento
 * @param params - Parámetros del cambio de estado
 * @returns Información sobre el cambio de estado
 * 
 * @throws {ApiError} Si la transición no es válida (400)
 * 
 * @example
 * const result = await eventsApi.changeEventStatus(123, {
 *   newStatus: 'APROBADO',
 *   reason: 'Revisión completada'
 * });
 * 
 * if (result.approvalPending) {
 *   console.log('Aprobaciones pendientes:', result.missingApprovals);
 * }
 */
export async function changeEventStatus(
  eventId: number,
  params: ChangeStatusInput
): Promise<BackendStatusChangeResponse> {
  return await httpClient.post<BackendStatusChangeResponse>(
    ENDPOINTS.EVENT_STATUS(eventId),
    params
  );
}

/**
 * Verifica disponibilidad de un espacio para una fecha/hora
 * 
 * @param params - Parámetros de disponibilidad
 * @returns Información sobre disponibilidad y conflictos
 * 
 * @example
 * const availability = await eventsApi.checkAvailability({
 *   spaceId: 5,
 *   date: '2025-12-01',
 *   scheduleFrom: '09:00',
 *   scheduleTo: '11:00',
 *   bufferBeforeMin: 15,
 *   bufferAfterMin: 15
 * });
 * 
 * if (!availability.available) {
 *   console.log('Conflictos:', availability.conflicts);
 * }
 */
export async function checkAvailability(
  params: AvailabilityCheckParams
): Promise<AvailabilityResponse> {
  const response = await httpClient.post<BackendSpaceAvailabilityResponse>(
    '/api/events/check-availability',
    params
  );

  // Adaptar respuesta (ya está en formato adecuado, solo normalizar)
  return {
    available: response.isAvailable === true,
    conflicts: response.conflicts.map(conflict => ({
      eventId: conflict.eventId,
      eventName: conflict.title,
      from: conflict.from,
      to: conflict.to,
      status: conflict.status,
      bufferBefore: conflict.bufferBeforeMin ?? undefined,
      bufferAfter: conflict.bufferAfterMin ?? undefined
    }))
  };
}

/**
 * Obtiene eventos de calendario en un rango de fechas
 * Optimizado para vistas de calendario
 * 
 * @param startDate - Fecha inicial (yyyy-MM-dd)
 * @param endDate - Fecha final (yyyy-MM-dd)
 * @returns Array de eventos en el rango
 * 
 * @example
 * const events = await eventsApi.getCalendarEvents(
 *   '2025-12-01',
 *   '2025-12-31'
 * );
 */
export async function getCalendarEvents(
  startDate: string,
  endDate: string
): Promise<Event[]> {
  const backendEvents = await httpClient.get<BackendEventDTO[]>(
    `/api/events/range?start=${startDate}&end=${endDate}`
  );

  return adaptEventsFromBackend(backendEvents);
}

/**
 * Obtiene lista simple de eventos activos (sin paginación)
 * Este endpoint del backend devuelve directamente un array de eventos
 * 
 * @returns Array de eventos activos
 * 
 * @example
 * ```ts
 * const events = await eventsApi.listActive();
 * console.log(`Total eventos activos: ${events.length}`);
 * ```
 */
export async function listActive(): Promise<Event[]> {
  // El backend devuelve directamente un array, no un Page
  const backendEvents = await httpClient.get<BackendEventDTO[]>(ENDPOINTS.EVENTS);
  
  // Adaptar cada evento del formato backend al frontend
  return backendEvents.map(adaptEventFromBackend);
}

// ==================== EXPORT DEFAULT ====================

/**
 * API de Eventos - Objeto con todas las funciones
 * Permite importar como: import { eventsApi } from '@/services/api'
 */
export const eventsApi = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  changeEventStatus,
  checkAvailability,
  getCalendarEvents,
  listActive
};

// Export individual de funciones para tree-shaking
export default eventsApi;
