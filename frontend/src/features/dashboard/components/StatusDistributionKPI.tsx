/**
 * ===================================================================
 * COMPONENT: StatusDistributionKPI
 * ===================================================================
 * KPI que muestra la distribución de eventos por estado.
 * Destaca el estado predominante y muestra un desglose visual.
 * ===================================================================
 */

import { BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KPICard } from './KPICard';
import type { EventStatus } from '@/models/event-status';
import { cn } from '@/lib/utils';

interface StatusDistributionKPIProps {
  /** Distribución de eventos por estado */
  distribution: Partial<Record<EventStatus, number>>;
}

/**
 * Configuración de estilos y etiquetas por estado
 */
const STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  EN_REVISION: { label: 'En revisión', color: 'bg-yellow-500' },
  RESERVADO: { label: 'Reservado', color: 'bg-indigo-500' },
  APROBADO: { label: 'Aprobado', color: 'bg-green-500' },
  RECHAZADO: { label: 'Rechazado', color: 'bg-red-500' },
};

/**
 * KPI: Distribución por estado
 * 
 * @example
 * ```tsx
 * <StatusDistributionKPI 
 *   distribution={{ APROBADO: 8, RESERVADO: 2, EN_REVISION: 2 }}
 * />
 * ```
 */
export function StatusDistributionKPI({ distribution }: StatusDistributionKPIProps) {
  // Calcular total
  const total = Object.values(distribution).reduce((sum, count) => (sum || 0) + (count || 0), 0);
  
  // Ordenar por cantidad (descendente) y filtrar estados con eventos
  const entries = Object.entries(distribution)
    .filter(([_, count]) => (count || 0) > 0)
    .sort(([_, a], [__, b]) => (b || 0) - (a || 0));

  // Estado predominante (el que tiene más eventos)
  const [topStatus, topCount] = entries[0] || ['EN_REVISION', 0];
  const topConfig = STATUS_CONFIG[topStatus as EventStatus];

  return (
    <KPICard
      title="Por estado"
      description="Distribución del día"
      icon={BarChart3}
      iconColor="text-purple-600"
    >
      <div className="space-y-2">
        {/* Valor principal: estado con más eventos */}
        <div className="flex items-end justify-between">
          <span className="text-3xl font-semibold text-slate-900">
            {topCount}
          </span>
          <Badge
            className={cn(
              'text-white',
              topConfig?.color || 'bg-slate-500'
            )}
          >
            {topConfig?.label || topStatus}
          </Badge>
        </div>

        {/* Barra de distribución visual */}
        {total > 0 && (
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            {entries.map(([status, count]) => {
              const config = STATUS_CONFIG[status as EventStatus];
              const percentage = ((count || 0) / total) * 100;
              return (
                <div
                  key={status}
                  className={cn('h-full', config.color)}
                  style={{ width: `${percentage}%` }}
                  title={`${config.label}: ${count}`}
                />
              );
            })}
          </div>
        )}

        {/* Desglose en chips */}
        <div className="flex flex-wrap gap-1.5">
          {entries.slice(0, 5).map(([status, count]) => {
            const config = STATUS_CONFIG[status as EventStatus];
            return (
              <div
                key={status}
                className="flex items-center gap-1 text-xs text-slate-600"
              >
                <span
                  className={cn('h-2 w-2 rounded-full', config.color)}
                />
                <span>
                  {count} {config.label.toLowerCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </KPICard>
  );
}
