import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Event } from '@/models/event';
import { formatBuffers, getTechSupportModeLabel } from '@/features/events/utils/approval-helpers';
import { getAudienceTypeLabel, getPriorityLabel } from '@/utils/event-status';

interface EventOperationalCardProps {
  event: Event;
  techCapacitySaturated: boolean;
  saturatedBlocks: Array<{
    from: string;
    to: string;
  }>;
}

export function EventOperationalCard({
  event,
  techCapacitySaturated,
  saturatedBlocks,
}: EventOperationalCardProps) {
  const buffersLabel = formatBuffers(event.bufferBeforeMin, event.bufferAfterMin);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos operativos</CardTitle>
        <CardDescription>Información útil para la gestión administrativa</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OperationalField label="Buffers" value={buffersLabel || 'Sin buffers configurados'} />
          <OperationalField label="Requiere técnica" value={event.requiresTech ? 'Sí' : 'No'} />
          <OperationalField
            label="Modo de soporte"
            value={event.requiresTech ? getTechSupportModeLabel(event.techSupportMode) : 'No aplica'}
          />
          <OperationalField
            label="Horario técnico"
            value={event.technicalSchedule || 'No informado'}
          />
          <OperationalField label="Prioridad" value={getPriorityLabel(event.priority)} />
          <OperationalField label="Audiencia" value={getAudienceTypeLabel(event.audienceType)} />
        </div>

        <div className="flex flex-wrap gap-2">
          {event.requiresRebooking ? (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-600">
              Requiere reprogramación
            </Badge>
          ) : null}
          {event.internal ? (
            <Badge variant="outline">Interno</Badge>
          ) : (
            <Badge variant="outline">Visible públicamente</Badge>
          )}
          {techCapacitySaturated ? (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-600">
              Capacidad técnica colmada
            </Badge>
          ) : null}
        </div>

        {techCapacitySaturated && saturatedBlocks.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Bloques saturados</p>
            <p className="text-sm text-muted-foreground">
              {saturatedBlocks.map((block) => `${block.from}-${block.to}`).join(', ')}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OperationalField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
