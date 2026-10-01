/**
 * ===================================================================
 * HOOK: usePriorityConflicts
 * ===================================================================
 * Hook para obtener conflictos de prioridad pendientes
 * ===================================================================
 */

import { useQuery } from '@tanstack/react-query';
import { fetchPendingConflicts } from '@/services/api/priority';
import { useCan } from '@/hooks/useCan';

/**
 * Hook para obtener conflictos de prioridad pendientes
 * 
 * Características:
 * - Caché de 3 minutos (staleTime)
 * - Auto-refresh cada 5 minutos
 * - Obtiene solo la primera página (suficiente para alertas del dashboard)
 * 
 * Solo consulta si el rol puede ver conflictos de prioridad.
 *
 * @returns Query object con data, isLoading, error, refetch
 */
export function usePriorityConflicts() {
  // GET /api/priority/conflicts/** es solo AF/AC/AT (docs/permisos.md)
  const enabled = useCan()('read', 'Priority');

  return useQuery({
    enabled,
    queryKey: ['priority', 'conflicts', 'pending'],
    queryFn: () => fetchPendingConflicts(0, 50), // Primera página, hasta 50 conflictos
    staleTime: 3 * 60 * 1000, // 3 minutos
    refetchInterval: 5 * 60 * 1000, // Auto-refresh cada 5 minutos
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
