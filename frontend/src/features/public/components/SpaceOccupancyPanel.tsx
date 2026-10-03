/**
 * ===================================================================
 * PANEL DE OCUPACIÓN DE ESPACIO
 * ===================================================================
 * Muestra visualmente la ocupación del espacio seleccionado en un día.
 * Incluye timeline con eventos existentes y el horario seleccionado.
 * ===================================================================
 */

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SpaceOccupancyResult } from '@/services/api';

export interface SpaceOccupancyPanelProps {
  occupancy: SpaceOccupancyResult | null;
  isLoading?: boolean;
  selectedFrom?: string;
  selectedTo?: string;
}

/**
 * Convierte hora HH:mm a minutos desde medianoche
 */
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convierte minutos desde medianoche a hora HH:mm
 */
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Calcula el porcentaje de posición en el timeline (0-100%)
 */
const calculatePosition = (time: string, startMinute: number, endMinute: number): number => {
  const timeMinutes = timeToMinutes(time);
  const totalMinutes = endMinute - startMinute;
  return ((timeMinutes - startMinute) / totalMinutes) * 100;
};

/**
 * Calcula el ancho del bloque en el timeline
 */
const calculateWidth = (
  from: string,
  to: string,
  startMinute: number,
  endMinute: number
): number => {
  const fromMinutes = timeToMinutes(from);
  const toMinutes = timeToMinutes(to);
  const totalMinutes = endMinute - startMinute;
  return ((toMinutes - fromMinutes) / totalMinutes) * 100;
};

export function SpaceOccupancyPanel({
  occupancy,
  isLoading,
  selectedFrom,
  selectedTo,
}: SpaceOccupancyPanelProps) {
  // Calcular rango del timeline (hora más temprana y más tardía)
  const timelineRange = useMemo(() => {
    if (!occupancy || occupancy.occupied.length === 0) {
      return { start: 480, end: 1200 }; // 08:00 - 20:00 por defecto
    }

    let minMinutes = 1440; // 24:00
    let maxMinutes = 0;

    occupancy.occupied.forEach((slot) => {
      const fromMinutes = timeToMinutes(slot.from);
      const toMinutes = timeToMinutes(slot.to);
      minMinutes = Math.min(minMinutes, fromMinutes);
      maxMinutes = Math.max(maxMinutes, toMinutes);
    });

    // Agregar selección actual si existe
    if (selectedFrom) {
      minMinutes = Math.min(minMinutes, timeToMinutes(selectedFrom));
    }
    if (selectedTo) {
      maxMinutes = Math.max(maxMinutes, timeToMinutes(selectedTo));
    }

    // Agregar padding de 1 hora antes y después
    minMinutes = Math.max(0, minMinutes - 60);
    maxMinutes = Math.min(1440, maxMinutes + 60);

    return { start: minMinutes, end: maxMinutes };
  }, [occupancy, selectedFrom, selectedTo]);

  // Estado de carga
  if (isLoading) {
    return (
      <Card className="p-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground">Cargando ocupación del espacio...</span>
        </div>
      </Card>
    );
  }

  // Sin datos
  if (!occupancy) {
    return null;
  }

  const { spaceName, date, occupied: slots } = occupancy;
  const { start: startMinute, end: endMinute } = timelineRange;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold">{spaceName || 'Ocupación del espacio'}</h3>
          <p className="text-sm text-muted-foreground">
            Ocupación del {new Date(date + 'T00:00:00').toLocaleDateString('es-AR')}
          </p>
        </div>

        {/* Timeline visual */}
        <div className="space-y-3">
          {/* Eje de tiempo */}
          <div className="relative h-8 bg-muted/30 rounded">
            {/* Marcadores de hora */}
            {Array.from({ length: Math.ceil((endMinute - startMinute) / 60) + 1 }, (_, i) => {
              const minute = startMinute + i * 60;
              if (minute > endMinute) return null;

              const position = ((minute - startMinute) / (endMinute - startMinute)) * 100;

              return (
                <div
                  key={minute}
                  className="absolute top-0 bottom-0 border-l border-border"
                  style={{ left: `${position}%` }}
                >
                  <span className="absolute -bottom-5 -translate-x-1/2 text-xs text-muted-foreground">
                    {minutesToTime(minute)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bloques de eventos */}
          <div className="space-y-2 mt-8">
            {slots.map((slot, index) => {
              const left = calculatePosition(slot.from, startMinute, endMinute);
              const width = calculateWidth(slot.from, slot.to, startMinute, endMinute);

              // Color según estado
              const colorClass =
                slot.status == null
                  ? 'bg-gray-500/80 border-gray-600'
                  : slot.status === 'APROBADO'
                  ? 'bg-green-500/80 border-green-600'
                  : slot.status === 'RESERVADO'
                    ? 'bg-blue-500/80 border-blue-600'
                    : 'bg-yellow-500/80 border-yellow-600';

              return (
                <div key={index} className="relative h-12">
                  <div
                    className={`absolute h-full rounded border-2 ${colorClass} flex items-center px-2 overflow-hidden`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${slot.eventName || 'Reservado'}\n${slot.from} - ${slot.to}\nEstado: ${slot.status ?? 'No informado'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {slot.status ?? 'Ocupado'}
                      </Badge>
                      <span className="text-xs text-white font-medium truncate">
                        {slot.eventName || 'Sin nombre'}
                      </span>
                      <span className="text-xs text-white/80 shrink-0">
                        {slot.from} - {slot.to}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Bloque del horario seleccionado */}
            {selectedFrom && selectedTo && (
              <div className="relative h-12">
                <div
                  className="absolute h-full rounded border-2 border-dashed border-primary bg-primary/20 flex items-center px-2"
                  style={{
                    left: `${calculatePosition(selectedFrom, startMinute, endMinute)}%`,
                    width: `${calculateWidth(selectedFrom, selectedTo, startMinute, endMinute)}%`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      SELECCIONADO
                    </Badge>
                    <span className="text-xs font-medium">
                      {selectedFrom} - {selectedTo}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/80 border-2 border-green-600" />
            <span className="text-xs text-muted-foreground">Aprobado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500/80 border-2 border-blue-600" />
            <span className="text-xs text-muted-foreground">Reservado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/80 border-2 border-yellow-600" />
            <span className="text-xs text-muted-foreground">En revisión</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-dashed border-primary bg-primary/20" />
            <span className="text-xs text-muted-foreground">Tu selección</span>
          </div>
        </div>

        {/* Resumen */}
        {slots.length === 0 ? (
          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-400">
              ✓ No hay eventos programados este día. El espacio está completamente disponible.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-400">
              ℹ️ Hay {slots.length} evento(s) programado(s) en este espacio. Verifique que su
              horario no coincida.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default SpaceOccupancyPanel;
