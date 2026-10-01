/**
 * ===================================================================
 * COMPONENTE: EventStatusBadge
 * ===================================================================
 * Badge que muestra el estado de un evento con colores específicos.
 * ===================================================================
 */

import { Badge } from '@/components/ui/badge';
import type { EventStatus } from '@/services/api/types/backend.types';
import { cn } from '@/lib/utils';

interface EventStatusBadgeProps {
  status: EventStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  EventStatus,
  { label: string; className: string }
> = {
  EN_REVISION: {
    label: 'En Revisión',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  RESERVADO: {
    label: 'Reservado',
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  APROBADO: {
    label: 'Aprobado',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  RECHAZADO: {
    label: 'Rechazado',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
};

export function EventStatusBadge({ status, className }: EventStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
