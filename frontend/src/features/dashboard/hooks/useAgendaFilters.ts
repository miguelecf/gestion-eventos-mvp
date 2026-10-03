/**
 * ===================================================================
 * HOOK: useAgendaFilters
 * ===================================================================
 * Gestiona el estado de los filtros de la Agenda del Dashboard.
 * Persiste las preferencias en sessionStorage para mantener el estado
 * durante la sesión del usuario.
 * ===================================================================
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'dashboard-agenda-filters';

/**
 * Interfaz de filtros de la Agenda
 */
export interface AgendaFilters {
  /** ID del espacio seleccionado (null = todos, -1 = sin espacio) */
  spaceId: number | null;
  
  /** ID del departamento seleccionado (null = todos) */
  departmentId: number | null;
  
  /** Filtrar solo eventos que requieren técnica */
  techRequired: boolean;
}

/**
 * Valores por defecto de los filtros
 */
const DEFAULT_FILTERS: AgendaFilters = {
  spaceId: null,
  departmentId: null,
  techRequired: false,
};

/**
 * Hook para gestionar filtros de la Agenda
 * 
 * @returns Estado y funciones para gestionar filtros
 * 
 * @example
 * ```tsx
 * function AgendaFilters() {
 *   const { filters, updateFilter, resetFilters } = useAgendaFilters();
 *   return (
 *     <SpaceFilter 
 *       value={filters.spaceId}
 *       onChange={(id) => updateFilter('spaceId', id)}
 *     />
 *   );
 * }
 * ```
 */
export function useAgendaFilters() {
  // Cargar filtros desde sessionStorage o usar defaults
  const [filters, setFilters] = useState<AgendaFilters>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_FILTERS;

      const parsed = JSON.parse(stored) as Partial<AgendaFilters>;
      return {
        spaceId: parsed.spaceId ?? DEFAULT_FILTERS.spaceId,
        departmentId: parsed.departmentId ?? DEFAULT_FILTERS.departmentId,
        techRequired: parsed.techRequired ?? DEFAULT_FILTERS.techRequired,
      };
    } catch (error) {
      console.warn('Error al cargar filtros desde sessionStorage:', error);
      return DEFAULT_FILTERS;
    }
  });

  // Persistir en sessionStorage cuando cambien los filtros
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn('Error al guardar filtros en sessionStorage:', error);
    }
  }, [filters]);

  /**
   * Actualiza un filtro específico
   */
  const updateFilter = useCallback(
    <K extends keyof AgendaFilters>(key: K, value: AgendaFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  /**
   * Resetea todos los filtros a valores por defecto
   */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Error al limpiar filtros de sessionStorage:', error);
    }
  }, []);

  /**
   * Verifica si hay filtros activos (distintos de los valores por defecto)
   */
  const hasActiveFilters =
    filters.spaceId !== null ||
    filters.departmentId !== null ||
    filters.techRequired;

  return {
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
  };
}
