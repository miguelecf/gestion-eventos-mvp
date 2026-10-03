/**
 * ===================================================================
 * API SERVICE: Priority Conflicts
 * ===================================================================
 * Servicio para gestionar conflictos de prioridad entre eventos
 * ===================================================================
 */

import { httpClient } from './client';
import type { Priority } from './types/backend.types';

/**
 * Respuesta del backend para un conflicto pendiente
 */
interface BackendPendingConflict {
  conflictId: string;
  highEventId: number;
  displacedEventId: number;
  spaceId: number;
  date: string;           // yyyy-MM-dd
  from: string;           // HH:mm
  to: string;             // HH:mm
  priorityHigh: Priority;
  priorityDisplaced: Priority;
  requiresRebooking: boolean;
  createdAt: string;      // ISO string
  createdByUserId: number;
}

/**
 * Respuesta paginada del backend
 */
interface BackendPageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

/**
 * Conflicto de prioridad (formato frontend)
 */
export interface PriorityConflict {
  id: string;
  conflictId: string;
  highEventId: number;
  displacedEventId: number;
  spaceId: number;
  date: string;
  from: string;
  to: string;
  timeRange: string;        // "HH:mm - HH:mm"
  priorityHigh: Priority;
  priorityDisplaced: Priority;
  requiresRebooking: boolean;
  createdAt: string;
}

/**
 * Obtiene todos los conflictos de prioridad pendientes
 * 
 * @param page - Número de página (0-indexed)
 * @param size - Tamaño de página
 */
export async function fetchPendingConflicts(
  page: number = 0,
  size: number = 20
): Promise<PriorityConflict[]> {
  const response = await httpClient.get<BackendPageResponse<BackendPendingConflict>>(
    '/api/priority/conflicts/pending',
    { 
      params: { 
        page, 
        size,
        sort: 'createdAt,desc'
      } 
    }
  );

  // Transformar respuesta del backend al formato del frontend
  return response.content.map(conflict => ({
    id: conflict.conflictId,
    conflictId: conflict.conflictId,
    highEventId: conflict.highEventId,
    displacedEventId: conflict.displacedEventId,
    spaceId: conflict.spaceId,
    date: conflict.date,
    from: conflict.from,
    to: conflict.to,
    timeRange: `${conflict.from} - ${conflict.to}`,
    priorityHigh: conflict.priorityHigh,
    priorityDisplaced: conflict.priorityDisplaced,
    requiresRebooking: conflict.requiresRebooking,
    createdAt: conflict.createdAt,
  }));
}

/**
 * @deprecated - Usar fetchPendingConflicts en su lugar
 */
export async function fetchPriorityConflicts(): Promise<PriorityConflict[]> {
  return fetchPendingConflicts();
}
