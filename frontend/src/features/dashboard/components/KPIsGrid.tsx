/**
 * ===================================================================
 * COMPONENT: KPIsGrid
 * ===================================================================
 * Grid contenedor de todos los KPIs del dashboard.
 * Muestra 4 métricas principales en un layout responsive.
 * ===================================================================
 */

import { useDashboardKPIs } from '../hooks/useDashboardKPIs';
import { TotalEventsKPI } from './TotalEventsKPI';
import { StatusDistributionKPI } from './StatusDistributionKPI';
import { ConformityPendingKPI } from './ConformityPendingKPI';
import { TechLoadKPI } from './TechLoadKPI';
import { useCan } from '@/hooks/useCan';

/**
 * Grid de Indicadores KPI del Dashboard
 * 
 * Layout:
 * - Desktop (xl): 4 columnas
 * - Tablet (md): 2 columnas
 * - Móvil: 1 columna (stack vertical)
 * 
 * @example
 * ```tsx
 * <KPIsGrid />
 * ```
 */
export function KPIsGrid() {
  const kpis = useDashboardKPIs();
  const canViewTechCapacity = useCan()('viewTechCapacity', 'TechCapacity');

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {/* KPI 1: Total de eventos del día */}
      <TotalEventsKPI count={kpis.totalEvents} />

      {/* KPI 2: Distribución por estado */}
      <StatusDistributionKPI distribution={kpis.statusDistribution} />

      {/* KPI 3: Pendientes de conformidad */}
      <ConformityPendingKPI pending={kpis.conformityPending} />

      {/* KPI 4: Carga técnica */}
      <TechLoadKPI load={kpis.techLoad} showCapacity={canViewTechCapacity} />
    </section>
  );
}
