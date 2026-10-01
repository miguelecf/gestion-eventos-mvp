/**
 * ===================================================================
 * ALERTA DE CONFLICTO DE DISPONIBILIDAD
 * ===================================================================
 * Muestra información detallada cuando un evento no puede crearse
 * por conflicto de disponibilidad con otro evento existente.
 *
 * Se muestra cuando el backend retorna HTTP 409 con estructura
 * de AvailabilityConflictResponse.
 * ===================================================================
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { AvailabilityConflictResponse, EventStatus } from '@/services/api/types/backend.types';
import { useCatalogsStore } from '@/store/catalogs.store';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

interface ConflictAlertProps {
  conflictData: AvailabilityConflictResponse;
  requestedSpaceId?: number;
}

/**
 * Componente que muestra alerta detallada de conflicto
 */
export function ConflictAlert({
  conflictData,
  requestedSpaceId,
}: ConflictAlertProps) {
  const { spaces, fetchSpaces } = useCatalogsStore();

  // Cargar espacios si no están disponibles
  useEffect(() => {
    if (spaces.length === 0) {
      fetchSpaces();
    }
  }, [spaces.length, fetchSpaces]);

  // Obtener nombre del espacio solicitado
  const requestedSpace = requestedSpaceId
    ? spaces.find((s) => s.id === requestedSpaceId)
    : null;

  const spaceName = requestedSpace?.name || 'el espacio solicitado';

  // Si no hay conflictos, no mostrar nada
  if (!conflictData.conflicts || conflictData.conflicts.length === 0) {
    return null;
  }

  return (
    <Alert
      variant="destructive"
      className="border-red-300 bg-red-50 dark:bg-red-950/20"
    >
      <AlertTriangle className="h-5 w-5" />
      <AlertDescription>
        <div className="space-y-3">
          {/* Mensaje principal */}
          <p className="font-semibold text-red-900 dark:text-red-200">
            ❌ No se puede crear el evento: {spaceName} ya está ocupado en ese horario
          </p>

          {/* Lista de conflictos */}
          <div className="space-y-2">
            {conflictData.conflicts.map((conflict, index) => {
              // ⚠️ IMPORTANTE: from y to YA incluyen los buffers del backend
              // No necesitamos calcularlos nuevamente
              const effectiveFrom = conflict.from;  // Ya incluye buffer
              const effectiveTo = conflict.to;      // Ya incluye buffer
              
              const bufferBefore = conflict.bufferBeforeMin || 0;
              const bufferAfter = conflict.bufferAfterMin || 0;

              // Calcular horario base (SIN buffers) restándolos
              const baseFrom = calculateTimeWithBuffer(conflict.from, bufferBefore);
              const baseTo = calculateTimeWithBuffer(conflict.to, -bufferAfter);

              // Obtener nombre del espacio del conflicto
              const conflictSpace = spaces.find(
                (s) => s.id === conflict.spaceId
              );
              const conflictSpaceName = conflictSpace?.name || 'Espacio';

              return (
                <div
                  key={`conflict-${conflict.eventId}-${index}`}
                  className="p-3 bg-white dark:bg-gray-900 rounded-md border border-red-200 dark:border-red-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      {/* Espacio */}
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        📍 {conflictSpaceName}
                      </p>

                      {/* Franja ocupada */}
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">
                          Franja ocupada (incluye buffers):
                        </span>{' '}
                        <span className="font-mono">
                          {effectiveFrom} – {effectiveTo}
                        </span>
                      </p>

                      {/* Evento en conflicto */}
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">Evento:</span> "
                        {conflict.title}"
                      </p>

                      {/* Horario base (sin buffers) */}
                      {(bufferBefore > 0 || bufferAfter > 0) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Horario base: {baseFrom} – {baseTo}
                          {bufferBefore > 0 &&
                            ` (buffer antes: ${bufferBefore} min)`}
                          {bufferAfter > 0 &&
                            ` (buffer después: ${bufferAfter} min)`}
                        </p>
                      )}
                    </div>

                    {/* Badge de estado */}
                    <Badge variant={getStatusVariant(conflict.status)}>
                      {conflict.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mensaje de ayuda */}
          <p className="text-sm text-gray-600 dark:text-gray-400 italic">
            💡 Sugerencia: Seleccione otro horario, otro espacio, o contacte al
            equipo de Ceremonial para resolver el conflicto.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Calcula un horario con offset en minutos
 * @param time - Hora en formato HH:mm
 * @param offsetMin - Minutos a sumar (negativo para restar)
 * @returns Hora resultante en formato HH:mm
 */
function calculateTimeWithBuffer(time: string, offsetMin: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + offsetMin;

  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;

  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(
    2,
    '0'
  )}`;
}

/**
 * Retorna la variante del Badge según el estado
 */
function getStatusVariant(
  status: EventStatus
): 'default' | 'success' | 'outline' {
  switch (status) {
    case 'APROBADO':
      return 'success'; // Verde
    case 'RESERVADO':
      return 'default'; // Color primario
    case 'EN_REVISION':
      return 'outline';
    case 'RECHAZADO':
      return 'outline'; // No hay destructive, usamos outline
    default:
      return 'outline';
  }
}

export default ConflictAlert;
