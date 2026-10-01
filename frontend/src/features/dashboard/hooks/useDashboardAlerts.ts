/**
 * ===================================================================
 * HOOK: useDashboardAlerts
 * ===================================================================
 * Hook agregador que detecta y consolida todas las alertas operativas
 * del dashboard. Utiliza helpers de event-rules.ts para evitar
 * duplicación de lógica.
 * ===================================================================
 */

import { useTodayEvents } from './useTodayEvents';
import { usePriorityConflicts } from './usePriorityConflicts';
import { useTechCapacity } from './useTechCapacity';
import { useCan } from '@/hooks/useCan';
import { eventRules } from '../utils/event-rules';
import { parseISO, differenceInHours, isToday } from 'date-fns';

export type AlertSeverity = 'high' | 'medium' | 'low';
export type AlertType = 'priority' | 'rebooking' | 'tech-capacity' | 'no-conformity';

export interface AlertItem {
  id: number | string;
  name: string;
  details: string;
}

export interface DashboardAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  count: number;
  actionLabel: string;
  actionHref: string;
  items: AlertItem[];
}

/**
 * Hook agregador de alertas del Dashboard
 * 
 * IMPORTANTE: Reutiliza la caché de React Query compartida.
 * useTodayEvents usa la misma queryKey que en TodayAgenda,
 * por lo que NO hay re-fetching innecesario.
 * 
 * @returns Array de alertas ordenadas por severidad
 */
export function useDashboardAlerts(): DashboardAlert[] {
  // Reutiliza caché de eventos (NO hace nueva petición)
  const { data: events } = useTodayEvents();
  const { data: conflicts } = usePriorityConflicts();
  const { data: techCapacity } = useTechCapacity();
  // Conflictos y capacidad técnica llegan undefined si el rol no puede verlos
  // (queries deshabilitadas): esas alertas simplemente no se generan.
  const canResolvePriority = useCan()('resolvePriority', 'Priority');

  const alerts: DashboardAlert[] = [];

  // ===================================================================
  // 1. CONFLICTOS DE PRIORIDAD PENDIENTES
  // ===================================================================
  if (conflicts && conflicts.length > 0) {
    // Filtrar solo conflictos del día actual
    const todayConflicts = conflicts.filter((conflict) => {
      try {
        return isToday(parseISO(conflict.date));
      } catch {
        return false;
      }
    });

    if (todayConflicts.length > 0) {
      alerts.push({
        id: 'priority-conflicts',
        type: 'priority',
        severity: 'high',
        title: 'Conflictos de prioridad pendientes',
        description: `${todayConflicts.length} conflicto${
          todayConflicts.length > 1 ? 's' : ''
        } requiere${todayConflicts.length > 1 ? 'n' : ''} resolución`,
        count: todayConflicts.length,
        actionLabel: canResolvePriority ? 'Resolver conflictos' : 'Ver eventos',
        actionHref: '/events',
        items: todayConflicts.slice(0, 3).map((c) => {
          // Buscar nombres de eventos en la lista de eventos del día
          const highEvent = events?.find(e => e.id === c.highEventId);
          const displacedEvent = events?.find(e => e.id === c.displacedEventId);

          const highName = highEvent?.name || `Evento #${c.highEventId}`;
          const displacedName = displacedEvent?.name || `Evento #${c.displacedEventId}`;

          return {
            id: c.id,
            name: `${highName} vs ${displacedName}`,
            details: `Espacio #${c.spaceId} · ${c.timeRange}`,
          };
        }),
      });
    }
  }

  // ===================================================================
  // 2. REPROGRAMACIONES PENDIENTES
  // ===================================================================
  if (events) {
    // Usa helper centralizado de event-rules
    const rebookingEvents = events.filter(eventRules.requiresRebooking);

    if (rebookingEvents.length > 0) {
      alerts.push({
        id: 'rebooking-pending',
        type: 'rebooking',
        severity: 'medium',
        title: 'Reprogramaciones pendientes',
        description: `${rebookingEvents.length} evento${
          rebookingEvents.length > 1 ? 's' : ''
        } necesita${rebookingEvents.length > 1 ? 'n' : ''} nueva reserva`,
        count: rebookingEvents.length,
        actionLabel: 'Abrir calendario',
        actionHref: '/calendar',
        items: rebookingEvents.slice(0, 3).map((e) => ({
          id: e.id,
          name: e.name,
          details: e.observations || 'Requiere reprogramación',
        })),
      });
    }
  }

  // ===================================================================
  // 3. FRANJAS TÉCNICAS AL LÍMITE
  // ===================================================================
  if (techCapacity) {
    const saturatedBlocks = techCapacity.blocks.filter(
      (b) => b.usedCapacity >= b.maxCapacity
    );

    if (saturatedBlocks.length > 0) {
      alerts.push({
        id: 'tech-capacity-limit',
        type: 'tech-capacity',
        severity: 'medium',
        title: 'Franjas técnicas al límite',
        description: `${saturatedBlocks.length} bloque${
          saturatedBlocks.length > 1 ? 's' : ''
        } sin capacidad disponible`,
        count: saturatedBlocks.length,
        actionLabel: 'Ver distribución',
        actionHref: '/events', // TODO: Ajustar cuando exista página de capacidad técnica
        items: saturatedBlocks.slice(0, 3).map((b) => ({
          id: b.id,
          name: `Bloque ${b.startTime}-${b.endTime}`,
          details: `${b.usedCapacity}/${b.maxCapacity} eventos`,
        })),
      });
    }
  }

  // ===================================================================
  // 4. EVENTOS PRÓXIMOS SIN CONFORMIDAD
  // ===================================================================
  if (events) {
    const upcomingNoConformity = events.filter((e) => {
      try {
        const eventTime = parseISO(`${e.date}T${e.scheduleFrom}`);
        const hoursUntil = differenceInHours(eventTime, new Date());

        // Usa helper centralizado para validar conformidad
        return (
          hoursUntil >= 0 &&
          hoursUntil < 2 &&
          eventRules.isMissingConformity(e)
        );
      } catch {
        return false;
      }
    });

    if (upcomingNoConformity.length > 0) {
      alerts.push({
        id: 'no-conformity-upcoming',
        type: 'no-conformity',
        severity: 'high',
        title: 'Eventos próximos sin conformidad',
        description: `${upcomingNoConformity.length} evento${
          upcomingNoConformity.length > 1 ? 's' : ''
        } inicia${upcomingNoConformity.length > 1 ? 'n' : ''} pronto`,
        count: upcomingNoConformity.length,
        actionLabel: 'Revisar eventos',
        actionHref: '/events',
        items: upcomingNoConformity.slice(0, 3).map((e) => {
          try {
            const eventTime = parseISO(`${e.date}T${e.scheduleFrom}`);
            const hoursUntil = differenceInHours(eventTime, new Date());
            const minutesUntil = Math.round((hoursUntil % 1) * 60);

            const timeText =
              hoursUntil < 1
                ? `${minutesUntil} min`
                : `${Math.floor(hoursUntil)}h ${minutesUntil}min`;

            const missingOk = !e.ceremonialOk
              ? 'Sin OK Ceremonial'
              : 'Sin OK Técnica';

            return {
              id: e.id,
              name: e.name,
              details: `Inicia en ${timeText} · ${missingOk}`,
            };
          } catch {
            return {
              id: e.id,
              name: e.name,
              details: 'Sin conformidad',
            };
          }
        }),
      });
    }
  }

  // ===================================================================
  // ORDENAR POR SEVERIDAD: high → medium → low
  // ===================================================================
  return alerts.sort((a, b) => {
    const severityOrder: Record<AlertSeverity, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
