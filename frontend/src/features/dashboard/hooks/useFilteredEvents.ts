/**
 * ===================================================================
 * HOOK: useFilteredEvents
 * ===================================================================
 * Filtra eventos según los filtros activos de la Agenda.
 * Aplica filtros de forma combinada (AND) en el cliente.
 * ===================================================================
 */

import { useMemo } from 'react';
import type { Event } from '@/models/event';
import type { AgendaFilters } from './useAgendaFilters';

/**
 * Hook para filtrar eventos según filtros activos
 * 
 * @param events - Array de eventos a filtrar
 * @param filters - Filtros activos
 * @returns Array de eventos filtrados
 * 
 * @example
 * ```tsx
 * function TodayAgenda() {
 *   const { data: events } = useTodayEvents();
 *   const { filters } = useAgendaFilters();
 *   const filteredEvents = useFilteredEvents(events, filters);
 *   return <EventList events={filteredEvents} />;
 * }
 * ```
 */
export function useFilteredEvents(
  events: Event[] | undefined,
  filters: AgendaFilters
): Event[] {
  return useMemo(() => {
    // Si no hay eventos, retornar array vacío
    if (!events) return [];

    // Aplicar todos los filtros de forma combinada (AND)
    return events.filter((event) => {
      // ========================================
      // Filtro por espacio
      // ========================================
      if (filters.spaceId !== null) {
        // -1 significa "Sin espacio asignado"
        if (filters.spaceId === -1) {
          // Eventos con freeLocation (sin space asignado)
          if (!event.freeLocation || event.space !== null) {
            return false;
          }
        } else {
          // Eventos con un space específico
          if (event.space?.id !== filters.spaceId) {
            return false;
          }
        }
      }

      // ========================================
      // Filtro por departamento
      // ========================================
      if (filters.departmentId !== null) {
        if (event.department?.id !== filters.departmentId) {
          return false;
        }
      }

      // ========================================
      // Filtro por requiere técnica
      // ========================================
      if (filters.techRequired) {
        if (!event.requiresTech) {
          return false;
        }
      }

      // Si pasa todos los filtros, incluir el evento
      return true;
    });
  }, [events, filters]);
}
