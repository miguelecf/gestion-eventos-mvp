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

/**
 * Obtiene la lista de eventos públicos activos
 * Consume: GET /public/events
 * No requiere autenticación
 * 
 * @returns Lista de eventos públicos y aprobados
 */
export async function fetchPublicEvents(): Promise<Event[]> {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
    const response = await fetch(`${baseUrl}/public/events`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const backendEvents: BackendEventDTO[] = await response.json();
    return adaptEventsFromBackend(backendEvents);
  } catch (error) {
    console.error('Error fetching public events:', error);
    throw error;
  }
}
