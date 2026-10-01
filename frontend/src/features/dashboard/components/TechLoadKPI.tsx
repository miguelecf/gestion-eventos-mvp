/**
 * ===================================================================
 * COMPONENT: TechLoadKPI
 * ===================================================================
 * KPI que muestra la carga técnica del día:
 * - Cantidad de eventos que requieren soporte técnico
 * - Porcentaje máximo de capacidad usada en franjas técnicas
 * ===================================================================
 */

import { Wrench } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { KPICard } from './KPICard';
import { cn } from '@/lib/utils';

interface TechLoadKPIProps {
  /** Carga técnica */
  load: {
    /** Cantidad de eventos con técnica */
    count: number;
    /** Porcentaje máximo de capacidad usada (0-100) */
    maxCapacityUsed: number;
  };
  /** Mostrar la capacidad de franjas (requiere permiso viewTechCapacity) */
  showCapacity?: boolean;
}

/**
 * KPI: Carga técnica
 * 
 * @example
 * ```tsx
 * <TechLoadKPI 
 *   load={{ count: 7, maxCapacityUsed: 85 }}
 * />
 * ```
 */
export function TechLoadKPI({ load, showCapacity = true }: TechLoadKPIProps) {
  const isHigh = load.maxCapacityUsed >= 90;
  const isMedium = load.maxCapacityUsed >= 70;

  const getCapacityColor = () => {
    if (isHigh) return 'text-red-700';
    if (isMedium) return 'text-amber-700';
    return 'text-green-700';
  };

  const getProgressColor = () => {
    if (isHigh) return '[&>div]:bg-red-500';
    if (isMedium) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-green-500';
  };

  const getIconColor = () => {
    if (isHigh) return 'text-red-600';
    if (isMedium) return 'text-amber-600';
    return 'text-slate-600';
  };

  return (
    <KPICard
      title="Carga técnica"
      description="Eventos con soporte"
      icon={Wrench}
      iconColor={getIconColor()}
      className={isHigh ? 'border-red-200 bg-red-50/30' : ''}
    >
      <div className="space-y-3">
        {/* Cantidad de eventos */}
        <div className="flex items-end justify-between">
          <span className="text-3xl font-semibold text-slate-900">
            {load.count}
          </span>
          <span className="text-sm font-medium text-slate-600">
            evento{load.count !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Capacidad técnica (solo roles que pueden verla) */}
        {showCapacity ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Capacidad máxima:</span>
              <span className={cn('font-semibold', getCapacityColor())}>
                {Math.round(load.maxCapacityUsed)}%
              </span>
            </div>
            
            <Progress 
              value={load.maxCapacityUsed} 
              className={cn('h-2', getProgressColor())}
            />

            {/* Alerta si >= 90% */}
            {isHigh && (
              <p className="text-xs font-medium text-red-700">
                ⚠️ Capacidad casi completa
              </p>
            )}
          </div>
        ) : null}
      </div>
    </KPICard>
  );
}
