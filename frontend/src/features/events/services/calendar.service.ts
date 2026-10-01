/**
 * ===================================================================
 * SERVICIO DE CALENDARIO - CAPA DE LÓGICA DE NEGOCIO
 * ===================================================================
 * Encapsula la lógica de negocio específica del calendario
 * Actúa como intermediario entre el componente y la API
 * ===================================================================
 */

import { eventsApi } from '@/services/api';
import type { Event } from '@/models/event';

/**
 * Parámetros para cargar eventos del calendario
 */
export interface LoadCalendarEventsParams {
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
}

/**
 * Resultado de cargar eventos del calendario
 */
export interface LoadCalendarEventsResult {
  events: Event[];
  total: number;
}

/**
 * Obtiene eventos del calendario
 * 
 * @param params - Parámetros de búsqueda
 * @returns Eventos adaptados para el calendario
 */
export async function loadCalendarEvents(
  params: LoadCalendarEventsParams
): Promise<LoadCalendarEventsResult> {
  try {
    // Obtener eventos del API
    const events = await eventsApi.getCalendarEvents(
      params.startDate,
      params.endDate
    );

    // Retornar resultado
    return {
      events,
      total: events.length
    };
  } catch (error) {
    console.error('Error loading calendar events:', error);
    throw error;
  }
}

/**
 * Obtiene el color del evento según su prioridad
 * Lógica de negocio centralizada
 * 
 * @param event - Evento
 * @returns Color hexadecimal
 */
export function getEventColor(event: Event): string {
  // Si el espacio tiene color personalizado, usarlo
  if (event.space?.colorHex) {
    return event.space.colorHex;
  }

  // Si el departamento tiene color personalizado, usarlo
  if (event.department?.colorHex) {
    return event.department.colorHex;
  }

  // Sino, usar color según prioridad
  switch (event.priority) {
    case 'HIGH':
      return '#ef4444'; // Rojo
    case 'MEDIUM':
      return '#f59e0b'; // Ámbar
    case 'LOW':
      return '#3b82f6'; // Azul
    default:
      return '#6b7280'; // Gris
  }
}

/**
 * Obtiene el texto descriptivo de la prioridad
 * 
 * @param priority - Prioridad del evento
 * @returns Texto en español
 */
export function getPriorityLabel(priority: Event['priority']): string {
  const labels = {
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Baja'
  };
  return labels[priority] || 'Sin prioridad';
}

/**
 * Obtiene el texto descriptivo del estado
 * 
 * @param status - Estado del evento
 * @returns Texto en español
 */
export function getStatusLabel(status: Event['status']): string {
  const labels = {
    EN_REVISION: 'En Revisión',
    RESERVADO: 'Reservado',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado'
  };
  return labels[status] || status;
}

/**
 * Formatea la ubicación del evento
 * 
 * @param event - Evento
 * @returns Ubicación formateada
 */
export function getEventLocation(event: Event): string {
  if (event.space) {
    return `📍 ${event.space.name}`;
  }
  if (event.freeLocation) {
    return `📍 ${event.freeLocation}`;
  }
  return '';
}
