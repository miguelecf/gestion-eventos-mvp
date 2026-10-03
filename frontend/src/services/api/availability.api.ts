/**
 * ===================================================================
 * SDK DE DISPONIBILIDAD Y CAPACIDAD TÉCNICA - API DE ALTO NIVEL
 * ===================================================================
 * Proporciona funciones de alto nivel para consultar disponibilidad
 * de espacios y capacidad técnica.
 * ===================================================================
 */

import { httpClient } from './client';
import { ENDPOINTS } from './client/config';
import type { 
  BackendSpaceAvailabilityResponse,
  BackendPublicAvailabilityResponse,
  BackendTechnicalCapacityResponse,
  SpaceOccupancyResponse,
  EventStatus,
  Priority
} from './types/backend.types';
import { toBackendDate } from './adapters';

// ==================== TIPOS ESPECÍFICOS DEL SDK ====================

/**
 * Parámetros para verificar disponibilidad de espacio
 */
export interface CheckAvailabilityParams {
  spaceId: number;
  date: string; // yyyy-MM-dd o Date
  scheduleFrom: string; // HH:mm
  scheduleTo: string; // HH:mm
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  excludeEventId?: number; // Para excluir evento actual al editar
}

/**
 * Conflicto de disponibilidad adaptado
 */
export interface AvailabilityConflict {
  eventId?: number;
  eventName?: string;
  from: string; // HH:mm
  to: string; // HH:mm
  status?: EventStatus | null;
  priority?: Priority;
  bufferBefore?: number;
  bufferAfter?: number;
}

/**
 * Respuesta de disponibilidad adaptada
 */
export interface AvailabilityResult {
  available: boolean;
  conflicts: AvailabilityConflict[];
  message: string; // Mensaje descriptivo
}

/**
 * Bloque de capacidad técnica
 */
export interface TechCapacityBlock {
  time: string; // HH:mm
  from: string; // HH:mm
  to: string; // HH:mm
  used: number;
  available: number;
  utilizationPercent: number;
  isOverCapacity: boolean;
}

/**
 * Respuesta de capacidad técnica adaptada
 */
export interface TechCapacityResult {
  date: string; // yyyy-MM-dd
  maxCapacity: number;
  blocks: TechCapacityBlock[];
  summary: {
    totalUsed: number;
    totalAvailable: number;
    averageUtilization: number;
    peakUtilization: number;
    peakTime: string;
    hasOverCapacity: boolean;
  };
}

/**
 * Evento con soporte técnico
 */
export interface TechSupportEvent {
  id: number;
  name: string;
  date: string;
  scheduleFrom: string;
  scheduleTo: string;
  spaceId: number;
  spaceName: string;
  techSupportMode: string;
  status: EventStatus;
}

/**
 * Parámetros para obtener eventos con soporte técnico
 */
export interface GetTechEventsParams {
  date: string; // yyyy-MM-dd o Date
}

/**
 * Parámetros para ocupación pública de espacio
 */
export interface GetSpaceOccupancyParams {
  spaceId: number;
  date: string; // yyyy-MM-dd o Date
}

/**
 * Slot de ocupación de espacio
 */
export interface OccupancySlot {
  from: string; // HH:mm
  to: string; // HH:mm
  eventName?: string;
  status: EventStatus | null;
}

/**
 * Respuesta de ocupación de espacio
 */
export interface SpaceOccupancyResult {
  spaceId: number;
  spaceName?: string;
  date: string;
  occupied: OccupancySlot[];
  availableSlots: Array<{ from: string; to: string }>;
}

// ==================== FUNCIONES DEL SDK ====================

/**
 * Verifica disponibilidad de un espacio en fecha/hora específica
 * Endpoint interno (requiere autenticación)
 * 
 * @param params - Parámetros de disponibilidad
 * @returns Resultado con disponibilidad y conflictos
 * 
 * @example
 * const result = await availabilityApi.checkAvailability({
 *   spaceId: 5,
 *   date: '2025-12-01',
 *   scheduleFrom: '09:00',
 *   scheduleTo: '11:00',
 *   bufferBeforeMin: 15,
 *   bufferAfterMin: 15
 * });
 * 
 * if (!result.available) {
 *   console.log('Conflictos:', result.conflicts);
 * }
 */
export async function checkAvailability(
  params: CheckAvailabilityParams
): Promise<AvailabilityResult> {
  // Normalizar fecha si viene como Date
  const date = typeof params.date === 'string' 
    ? params.date 
    : toBackendDate(params.date);

  const requestBody = {
    spaceId: params.spaceId,
    date,
    scheduleFrom: params.scheduleFrom,
    scheduleTo: params.scheduleTo,
    bufferBeforeMin: params.bufferBeforeMin,
    bufferAfterMin: params.bufferAfterMin,
    ignoreEventId: params.excludeEventId
  };

  const response = await httpClient.post<BackendSpaceAvailabilityResponse>(
    ENDPOINTS.AVAILABILITY_CHECK,
    requestBody
  );

  // Adaptar respuesta
  const conflicts: AvailabilityConflict[] = response.conflicts.map(conflict => ({
    eventId: conflict.eventId,
    eventName: conflict.title,
    from: conflict.from,
    to: conflict.to,
    status: conflict.status,
    bufferBefore: conflict.bufferBeforeMin ?? undefined,
    bufferAfter: conflict.bufferAfterMin ?? undefined
  }));

  // Generar mensaje descriptivo
  let message = '';
  if (response.isAvailable) {
    message = '✅ Espacio disponible para la fecha y horario solicitado';
  } else {
    const count = conflicts.length;
    message = `❌ Espacio no disponible (${count} ${count === 1 ? 'conflicto' : 'conflictos'} detectado${count === 1 ? '' : 's'})`;
  }

  return {
    available: response.isAvailable === true,
    conflicts,
    message
  };
}

/**
 * Verifica disponibilidad pública (sin autenticación)
 * Endpoint público para solicitudes externas
 * 
 * @param params - Parámetros de disponibilidad
 * @returns Resultado con disponibilidad y franjas en conflicto (sin datos identificatorios)
 * 
 * @example
 * const result = await availabilityApi.checkPublicAvailability({
 *   spaceId: 5,
 *   date: '2025-12-01',
 *   scheduleFrom: '09:00',
 *   scheduleTo: '11:00'
 * });
 */
export async function checkPublicAvailability(
  params: Omit<CheckAvailabilityParams, 'excludeEventId'>
): Promise<AvailabilityResult> {
  const date = typeof params.date === 'string' 
    ? params.date 
    : toBackendDate(params.date);

  const requestBody = {
    spaceId: params.spaceId,
    date,
    scheduleFrom: params.scheduleFrom,
    scheduleTo: params.scheduleTo,
    bufferBeforeMin: params.bufferBeforeMin,
    bufferAfterMin: params.bufferAfterMin
  };

  const response = await httpClient.post<BackendPublicAvailabilityResponse>(
    ENDPOINTS.AVAILABILITY_PUBLIC_CHECK,
    requestBody
  );

  const conflicts: AvailabilityConflict[] = response.conflicts.map(conflict => ({
    from: conflict.from,
    to: conflict.to,
    status: conflict.status,
  }));

  let message = '';
  if (response.isAvailable) {
    message = '✅ Espacio disponible';
  } else {
    message = `❌ Espacio no disponible (${conflicts.length} ${conflicts.length === 1 ? 'conflicto' : 'conflictos'})`;
  }

  return {
    available: response.isAvailable === true,
    conflicts,
    message
  };
}

/**
 * Obtiene la capacidad técnica disponible para una fecha específica
 * Endpoint interno (requiere permisos)
 * 
 * @param date - Fecha a consultar (yyyy-MM-dd o Date)
 * @returns Capacidad técnica con bloques horarios y resumen
 * 
 * @example
 * const capacity = await availabilityApi.getTechCapacity('2025-12-01');
 * 
 * console.log(`Capacidad máxima: ${capacity.maxCapacity}`);
 * console.log(`Utilización promedio: ${capacity.summary.averageUtilization}%`);
 * 
 * if (capacity.summary.hasOverCapacity) {
 *   console.warn(`⚠️ Sobrecapacidad en ${capacity.summary.peakTime}`);
 * }
 */
export async function getTechCapacity(
  date: string | Date
): Promise<TechCapacityResult> {
  const normalizedDate = typeof date === 'string' ? date : toBackendDate(date);

  const response = await httpClient.get<BackendTechnicalCapacityResponse>(
    `${ENDPOINTS.INTERNAL_TECH_CAPACITY}?date=${normalizedDate}`
  );

  const maxCapacity = response.defaultSlots;

  // Adaptar bloques con cálculos adicionales
  const blocks: TechCapacityBlock[] = response.blocks.map(block => {
    const time = block.from;
    const from = block.from;
    const to = block.to;
    const utilizationPercent = maxCapacity > 0 
      ? Math.round((block.used / maxCapacity) * 100)
      : 0;
    
    return {
      time,
      from,
      to,
      used: block.used,
      available: block.available,
      utilizationPercent,
      isOverCapacity: block.available === 0
    };
  });

  // Calcular resumen
  const totalUsed = blocks.reduce((sum, b) => sum + b.used, 0);
  const totalAvailable = blocks.reduce((sum, b) => sum + b.available, 0);
  const avgUtilization = blocks.length > 0
    ? Math.round(blocks.reduce((sum, b) => sum + b.utilizationPercent, 0) / blocks.length)
    : 0;
  
  const peakBlock = blocks.reduce((max, b) => 
    b.utilizationPercent > max.utilizationPercent ? b : max,
    blocks[0] || { utilizationPercent: 0, time: '' }
  );

  const hasOverCapacity = blocks.some(b => b.isOverCapacity);

  return {
    date: response.date,
    maxCapacity,
    blocks,
    summary: {
      totalUsed,
      totalAvailable,
      averageUtilization: avgUtilization,
      peakUtilization: peakBlock.utilizationPercent,
      peakTime: peakBlock.time,
      hasOverCapacity
    }
  };
}

/**
 * Obtiene eventos con soporte técnico para una fecha específica
 * Endpoint interno (requiere permisos)
 * 
 * @param params - Parámetros con fecha
 * @returns Array de eventos con soporte técnico
 * 
 * @example
 * const events = await availabilityApi.getTechEvents({ 
 *   date: '2025-12-01' 
 * });
 * 
 * events.forEach(event => {
 *   console.log(`${event.name}: ${event.scheduleFrom} - ${event.scheduleTo}`);
 *   console.log(`Modo: ${event.techSupportMode}`);
 * });
 */
export async function getTechEvents(
  params: GetTechEventsParams
): Promise<TechSupportEvent[]> {
  const date = typeof params.date === 'string' 
    ? params.date 
    : toBackendDate(params.date);

  const events = await httpClient.get<TechSupportEvent[]>(
    `${ENDPOINTS.INTERNAL_TECH_EVENTS}?date=${date}`
  );

  return events;
}

/**
 * Obtiene la ocupación pública de un espacio para una fecha
 * Endpoint público (sin autenticación)
 * 
 * @param params - Parámetros con spaceId y date
 * @returns Bloques horarios de ocupación según el contrato del backend
 * 
 * @example
 * const occupancy = await availabilityApi.getPublicSpaceOccupancy({
 *   spaceId: 5,
 *   date: '2025-12-01'
 * });
 * 
 * occupancy.occupied.forEach(slot => {
 *   console.log(`${slot.from} - ${slot.to}: ${slot.status ?? 'Ocupado'}`);
 * });
 */
export async function getPublicSpaceOccupancy(
  params: GetSpaceOccupancyParams
): Promise<SpaceOccupancyResult> {
  const date = typeof params.date === 'string' 
    ? params.date 
    : toBackendDate(params.date);

  const response = await httpClient.get<SpaceOccupancyResponse>(
    ENDPOINTS.PUBLIC_SPACE_OCCUPANCY(params.spaceId) + `?date=${date}`
  );

  return {
    spaceId: response.spaceId,
    date: response.date,
    occupied: response.blocks.map(block => ({
      from: block.from,
      to: block.to,
      status: block.status,
    })),
    availableSlots: [],
  };
}

/**
 * Verifica si hay capacidad técnica suficiente para un evento
 * Wrapper conveniente sobre getTechCapacity
 * 
 * @param date - Fecha del evento
 * @param scheduleFrom - Hora inicio (HH:mm)
 * @param scheduleTo - Hora fin (HH:mm)
 * @returns true si hay capacidad suficiente
 * 
 * @example
 * const hasCapacity = await availabilityApi.hasTechCapacity(
 *   '2025-12-01',
 *   '09:00',
 *   '11:00'
 * );
 * 
 * if (!hasCapacity) {
 *   alert('⚠️ Sin capacidad técnica disponible');
 * }
 */
export async function hasTechCapacity(
  date: string | Date,
  scheduleFrom: string,
  scheduleTo: string
): Promise<boolean> {
  const capacity = await getTechCapacity(date);
  
  // Filtrar bloques en el rango horario del evento
  const eventBlocks = capacity.blocks.filter(block => {
    return block.from < scheduleTo && block.to > scheduleFrom;
  });

  // Verificar que ninguno esté sobre capacidad
  return !eventBlocks.some(block => block.isOverCapacity);
}

/**
 * Obtiene los bloques con mayor utilización técnica en una fecha
 * 
 * @param date - Fecha a analizar
 * @param topN - Cantidad de bloques a retornar (default: 5)
 * @returns Bloques ordenados por utilización descendente
 * 
 * @example
 * const busyBlocks = await availabilityApi.getTopUtilizedBlocks('2025-12-01', 3);
 * busyBlocks.forEach(block => {
 *   console.log(`${block.time}: ${block.utilizationPercent}%`);
 * });
 */
export async function getTopUtilizedBlocks(
  date: string | Date,
  topN: number = 5
): Promise<TechCapacityBlock[]> {
  const capacity = await getTechCapacity(date);
  
  return capacity.blocks
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent)
    .slice(0, topN);
}

/**
 * Encuentra el primer slot disponible en un espacio para una duración específica
 * 
 * @param spaceId - ID del espacio
 * @param date - Fecha a buscar
 * @param durationMinutes - Duración del evento en minutos
 * @param startFrom - Hora mínima desde donde buscar (default: '08:00')
 * @param endBy - Hora máxima hasta donde buscar (default: '20:00')
 * @returns Primer slot disponible o null
 * 
 * @example
 * const slot = await availabilityApi.findFirstAvailableSlot(
 *   5, 
 *   '2025-12-01', 
 *   120, // 2 horas
 *   '09:00',
 *   '18:00'
 * );
 * 
 * if (slot) {
 *   console.log(`Disponible: ${slot.from} - ${slot.to}`);
 * }
 */
export async function findFirstAvailableSlot(
  spaceId: number,
  date: string | Date,
  durationMinutes: number,
  startFrom: string = '08:00',
  endBy: string = '20:00'
): Promise<{ from: string; to: string } | null> {
  const normalizedDate = typeof date === 'string' ? date : toBackendDate(date);
  const occupancy = await getPublicSpaceOccupancy({ spaceId, date: normalizedDate });
  
  // Buscar en los slots disponibles uno que cumpla con la duración
  for (const slot of occupancy.availableSlots) {
    // Calcular duración del slot
    const [fromH, fromM] = slot.from.split(':').map(Number);
    const [toH, toM] = slot.to.split(':').map(Number);
    const slotDuration = (toH * 60 + toM) - (fromH * 60 + fromM);
    
    // Verificar que el slot esté en el rango solicitado
    if (slot.from >= startFrom && slot.to <= endBy && slotDuration >= durationMinutes) {
      // Calcular el fin del evento dentro del slot
      const eventEnd = new Date(0, 0, 0, fromH, fromM + durationMinutes);
      const eventEndStr = `${String(eventEnd.getHours()).padStart(2, '0')}:${String(eventEnd.getMinutes()).padStart(2, '0')}`;
      
      return {
        from: slot.from,
        to: eventEndStr
      };
    }
  }
  
  return null;
}

// ==================== EXPORT DEFAULT ====================

/**
 * API de Disponibilidad y Capacidad Técnica - Objeto con todas las funciones
 * Permite importar como: import { availabilityApi } from '@/services/api'
 */
export const availabilityApi = {
  checkAvailability,
  checkPublicAvailability,
  getTechCapacity,
  getTechEvents,
  getPublicSpaceOccupancy,
  hasTechCapacity,
  getTopUtilizedBlocks,
  findFirstAvailableSlot
};

export default availabilityApi;
