/**
 * ===================================================================
 * HOOK: useDashboardKPIs
 * ===================================================================
 * Calcula las métricas (KPIs) del dashboard a partir de los eventos
 * y capacidad técnica del día actual.
 * 
 * Comparte caché con:
 * - useTodayEvents (Fase 1: Agenda)
 * - useDashboardAlerts (Fase 2: Alertas)
 * - useTechCapacity (Fase 2: Alertas)
 * ===================================================================
 */

import { useTodayEvents } from './useTodayEvents';
import { useTechCapacity } from './useTechCapacity';
import type { EventStatus } from '@/models/event-status';

/**
 * Interfaz de KPIs del Dashboard
 */
export interface DashboardKPIs {
  /** Total de eventos del día */
  totalEvents: number;
  
  /** Distribución de eventos por estado */
  statusDistribution: Partial<Record<EventStatus, number>>;
  
  /** Pendientes de conformidad */
  conformityPending: {
    /** Eventos sin OK de Ceremonial */
    ceremonial: number;
    /** Eventos sin OK de Técnica */
    technical: number;
  };
  
  /** Carga técnica del día */
  techLoad: {
    /** Cantidad de eventos que requieren técnica */
    count: number;
    /** Porcentaje máximo de capacidad usada (0-100) */
    maxCapacityUsed: number;
  };
}

/**
 * Hook para calcular KPIs del dashboard
 * 
 * @returns Métricas calculadas del dashboard
 * 
 * @example
 * ```tsx
 * function KPIsGrid() {
 *   const kpis = useDashboardKPIs();
 *   return (
 *     <div>
 *       <TotalEventsKPI count={kpis.totalEvents} />
 *       <StatusDistributionKPI distribution={kpis.statusDistribution} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useDashboardKPIs(): DashboardKPIs {
  // Comparte caché con Agenda (Fase 1) y Alertas (Fase 2)
  const { data: events = [] } = useTodayEvents();
  const { data: techCapacity } = useTechCapacity();

  // ========================================
  // KPI 1: Total de eventos del día
  // ========================================
  const totalEvents = events.length;

  // ========================================
  // KPI 2: Distribución por estado
  // ========================================
  const statusDistribution = events.reduce((acc, event) => {
    acc[event.status] = (acc[event.status] || 0) + 1;
    return acc;
  }, {} as Record<EventStatus, number>);

  // ========================================
  // KPI 3: Pendientes de conformidad
  // ========================================
  // Eventos que están en proceso (todo menos RECHAZADO)
  const inProcessStates: EventStatus[] = ['EN_REVISION', 'RESERVADO', 'APROBADO'];
  
  const conformityPending = {
    // Ceremonial: eventos en proceso sin OK de Ceremonial
    ceremonial: events.filter(
      (e) => !e.ceremonialOk && inProcessStates.includes(e.status)
    ).length,

    // Técnica: eventos con técnica requerida en proceso sin OK de Técnica
    technical: events.filter(
      (e) => 
        e.requiresTech && 
        !e.technicalOk && 
        inProcessStates.includes(e.status)
    ).length,
  };

  // ========================================
  // KPI 4: Carga técnica
  // ========================================
  const techLoad = {
    // Cantidad de eventos que requieren soporte técnico
    count: events.filter((e) => e.requiresTech).length,

    // Porcentaje máximo de capacidad usada en alguna franja
    maxCapacityUsed: techCapacity
      ? Math.max(
          ...techCapacity.blocks.map(
            (b) => (b.usedCapacity / b.maxCapacity) * 100
          ),
          0 // Default si no hay bloques
        )
      : 0, // Default si no hay datos de capacidad
  };

  return {
    totalEvents,
    statusDistribution,
    conformityPending,
    techLoad,
  };
}
