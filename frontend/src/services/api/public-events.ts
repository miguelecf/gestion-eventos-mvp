/**
 * ===================================================================
 * PUBLIC EVENTS API
 * ===================================================================
 * Servicio para consumir endpoints públicos de eventos
 * No requiere autenticación
 * ===================================================================
 */

import type { EventStatus, Priority } from './types/backend.types';
import { httpClient } from './client';

/**
 * Contrato público del calendario (PublicEventDto en backend).
 * No incluye contacto, usuarios ni datos de gestión.
 */
export interface PublicEvent {
  id: number;
  name: string;
  date: string;
  scheduleFrom: string;
  scheduleTo: string;
  status: EventStatus;
  priority: Priority;
  spaceName: string | null;
  freeLocation: string | null;
  departmentName: string | null;
}

/**
 * Obtiene la lista de eventos públicos activos
 * Consume: GET /public/events
 * No requiere autenticación
 * 
 * @returns Lista de eventos públicos y aprobados
 */
export async function fetchPublicEvents(): Promise<PublicEvent[]> {
  try {
    return await httpClient.get<PublicEvent[]>('/public/events');
  } catch (error) {
    console.error('Error fetching public events:', error);
    throw error;
  }
}
