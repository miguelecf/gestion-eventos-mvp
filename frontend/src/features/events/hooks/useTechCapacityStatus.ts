/**
 * ===================================================================
 * HOOK: useTechCapacityStatus
 * ===================================================================
 * Consulta GET /api/tech/capacity (fuente de verdad: uso por bloque calculado
 * en el backend) y evalúa SOLO los bloques que el evento consume, con la misma
 * regla que TechCapacityService.computeBlocks (hallazgo 5.4):
 *  - ATTENDED: [inicio - bufferAntes, fin + bufferDespués]
 *  - SETUP_ONLY: [inicio - bufferAntes, inicio] y [fin, fin + bufferDespués]
 * Limitación: el endpoint es por fecha; bloques de días adyacentes no se evalúan.
 * ===================================================================
 */

import { useEffect, useState } from 'react';
import { httpClient } from '@/services/api/client';

interface TechCapacityBlock {
  from: string;    // HH:mm
  to: string;      // HH:mm
  used: number;
  available: number;
}

interface TechCapacityResponse {
  date: string;
  blockMinutes: number;
  defaultSlots: number;
  blocks: TechCapacityBlock[];
}

interface UseTechCapacityStatusReturn {
  /** Si hay saturación en los bloques del evento */
  isSaturated: boolean;
  /** Si está cargando la información */
  loading: boolean;
  /** Error si falló la carga (null si no hay error) */
  error: string | null;
  /** Bloques saturados (available === 0) */
  saturatedBlocks: TechCapacityBlock[];
}

/**
 * Hook para verificar estado de capacidad técnica en una fecha/hora específica
 * 
 * COMPORTAMIENTO:
 * - Si el usuario no tiene permisos (401/403): falla silenciosamente (isSaturated = false)
 * - Si hay error de red: falla silenciosamente
 * - Solo muestra datos si el endpoint responde exitosamente
 * 
 * @param date - Fecha del evento (yyyy-MM-dd)
 * @param scheduleFrom - Hora de inicio (HH:mm)
 * @param scheduleTo - Hora de fin (HH:mm)
 * @param enabled - Si el hook debe ejecutarse (default: true)
 * 
 * @example
 * const { isSaturated, saturatedBlocks } = useTechCapacityStatus(
 *   '2025-12-15',
 *   '09:00',
 *   '11:00'
 * );
 * 
 * if (isSaturated) {
 *   console.log('Capacidad técnica colmada en:', saturatedBlocks);
 * }
 */
export function useTechCapacityStatus(
  date: string | null,
  scheduleFrom: string | null,
  scheduleTo: string | null,
  enabled: boolean = true,
  options: { bufferBeforeMin?: number; bufferAfterMin?: number; techSupportMode?: 'SETUP_ONLY' | 'ATTENDED' | string | null } = {}
): UseTechCapacityStatusReturn {
  const bufferBefore = options.bufferBeforeMin ?? 0;
  const bufferAfter = options.bufferAfterMin ?? 0;
  const mode = options.techSupportMode === 'ATTENDED' ? 'ATTENDED' : 'SETUP_ONLY';
  const [isSaturated, setIsSaturated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saturatedBlocks, setSaturatedBlocks] = useState<TechCapacityBlock[]>([]);

  useEffect(() => {
    // No ejecutar si no está habilitado o faltan datos
    if (!enabled || !date || !scheduleFrom || !scheduleTo) {
      setIsSaturated(false);
      setSaturatedBlocks([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchCapacity = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await httpClient.get<TechCapacityResponse>(
          `/api/tech/capacity?date=${date}`
        );

        if (cancelled) return;

        // Parsear horas de inicio y fin del evento
        const [startHour, startMinute] = scheduleFrom.split(':').map(Number);
        const [endHour, endMinute] = scheduleTo.split(':').map(Number);

        const eventStartMinutes = startHour * 60 + startMinute;
        const eventEndMinutes = endHour * 60 + endMinute;

        // Intervalos que el evento consume según modalidad y buffers (igual que el backend)
        const ranges: Array<[number, number]> = mode === 'ATTENDED'
          ? [[eventStartMinutes - bufferBefore, eventEndMinutes + bufferAfter]]
          : [
              ...(bufferBefore > 0 ? [[eventStartMinutes - bufferBefore, eventStartMinutes] as [number, number]] : []),
              ...(bufferAfter > 0 ? [[eventEndMinutes, eventEndMinutes + bufferAfter] as [number, number]] : []),
            ];

        const relevantBlocks = response.blocks.filter((block) => {
          const [blockStartHour, blockStartMinute] = block.from.split(':').map(Number);
          const [blockEndHour, blockEndMinute] = block.to.split(':').map(Number);
          const blockStartMinutes = blockStartHour * 60 + blockStartMinute;
          // El último bloque del día termina "00:00": equivale a 24:00
          const rawEnd = blockEndHour * 60 + blockEndMinute;
          const blockEndMinutes = rawEnd <= blockStartMinutes ? 24 * 60 : rawEnd;

          return ranges.some(([from, to]) => blockStartMinutes < to && blockEndMinutes > from);
        });

        // Filtrar bloques saturados (available === 0)
        const saturated = relevantBlocks.filter((block) => block.available === 0);

        setIsSaturated(saturated.length > 0);
        setSaturatedBlocks(saturated);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;

        // ✅ Degradación silenciosa: no mostrar error si es de permisos
        if (err?.status === 401 || err?.status === 403) {
          console.warn('[TechCapacity] Usuario sin permisos, omitiendo indicador');
        } else {
          console.error('[TechCapacity] Error al cargar capacidad técnica:', err);
          setError(err?.message || 'Error al cargar capacidad técnica');
        }

        setIsSaturated(false);
        setSaturatedBlocks([]);
        setLoading(false);
      }
    };

    fetchCapacity();

    return () => {
      cancelled = true;
    };
  }, [date, scheduleFrom, scheduleTo, enabled, bufferBefore, bufferAfter, mode]);

  return {
    isSaturated,
    loading,
    error,
    saturatedBlocks,
  };
}
