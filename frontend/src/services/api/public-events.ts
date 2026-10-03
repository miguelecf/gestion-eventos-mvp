/**
 * ===================================================================
 * PUBLIC EVENTS API
 * ===================================================================
 * Servicio para consumir endpoints públicos de eventos
 * No requiere autenticación
 * ===================================================================
 */

import type { Event } from '@/models/event';
import type { BackendEventDTO } from './types/backend.types';
import { adaptEventsFromBackend } from './adapters/event.adapter';
import { httpClient } from './client';

/**
 * Obtiene la lista de eventos públicos activos
 * Consume: GET /public/events
 * No requiere autenticación
 * 
 * @returns Lista de eventos públicos y aprobados
 */
export async function fetchPublicEvents(): Promise<Event[]> {
  try {
    const backendEvents = await httpClient.get<BackendEventDTO[]>('/public/events');
    return adaptEventsFromBackend(backendEvents);
  } catch (error) {
    console.error('Error fetching public events:', error);
    throw error;
  }
}
