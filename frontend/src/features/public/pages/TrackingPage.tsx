/**
 * ===================================================================
 * PANTALLA DE SEGUIMIENTO DE SOLICITUD
 * ===================================================================
 * Permite consultar el estado de una solicitud por su trackingUuid.
 * ===================================================================
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { publicRequestsApi } from '@/services/api';
import type { EventRequestStatusResponse } from '@/services/api';

export function TrackingPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const [data, setData] = useState<EventRequestStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uuid) {
      loadTrackingData(uuid);
    }
  }, [uuid]);

  const loadTrackingData = async (trackingUuid: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await publicRequestsApi.trackPublicEventRequest(trackingUuid);
      setData(response);
    } catch (err: any) {
      console.error('Error cargando tracking:', err);
      const errorMsg =
        err.response?.status === 404
          ? 'Código de seguimiento no encontrado'
          : 'Error al consultar el seguimiento';
      setError(errorMsg);
      toast.error('Error al cargar datos', {
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <Skeleton className="h-10 w-64 mb-6" />
        <Card className="p-6 mb-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
        <Card className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="container mx-auto max-w-3xl py-12 px-4">
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            <p className="font-semibold mb-2">❌ No se pudo cargar el seguimiento</p>
            <p className="text-sm">{error || 'Código de seguimiento inválido'}</p>
          </AlertDescription>
        </Alert>

        <div className="flex justify-center gap-3">
          <Button asChild variant="default">
            <Link to="/solicitud">Nueva Solicitud</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/public/calendar">Ver Calendario</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Render tracking data
  // La solicitud (RECIBIDO → EN_REVISION → CONVERTIDO/RECHAZADO) y el evento creado al convertirla
  // tienen ciclos de vida distintos: convertir NO equivale a aprobar. Si existe evento, manda su estado.
  type Stage = 'RECEIVED' | 'IN_REVIEW' | 'RESERVED' | 'APPROVED' | 'REJECTED';
  const stage: Stage = (() => {
    if (data.event) {
      switch (data.event.status) {
        case 'APROBADO': return 'APPROVED';
        case 'RESERVADO': return 'RESERVED';
        case 'RECHAZADO': return 'REJECTED';
        default: return 'IN_REVIEW';
      }
    }
    switch (data.request.status) {
      case 'EN_REVISION': return 'IN_REVIEW';
      case 'RECHAZADO': return 'REJECTED';
      default: return 'RECEIVED';
    }
  })();

  const stageConfig: Record<
    Stage,
    { label: string; color: string; variant: 'default' | 'success' | 'outline'; message: string }
  > = {
    RECEIVED: {
      label: 'Recibida',
      color: 'bg-blue-100 text-blue-800',
      variant: 'default',
      message: 'Su solicitud está pendiente de revisión. El equipo la evaluará pronto.',
    },
    IN_REVIEW: {
      label: data.event ? 'Convertida a evento · En revisión' : 'En Revisión',
      color: 'bg-yellow-100 text-yellow-800',
      variant: 'outline',
      message: data.event
        ? 'Su solicitud fue convertida en evento y está pendiente de la conformidad de Ceremonial y Técnica. Aún no está aprobada.'
        : 'Su solicitud está siendo revisada por el equipo.',
    },
    RESERVED: {
      label: 'Reservada',
      color: 'bg-emerald-100 text-emerald-800',
      variant: 'outline',
      message: 'El espacio quedó reservado para su evento. Falta la aprobación final.',
    },
    APPROVED: {
      label: 'Aprobada',
      color: 'bg-green-100 text-green-800',
      variant: 'success',
      message: 'Su evento fue aprobado y figura en el calendario público.',
    },
    REJECTED: {
      label: 'Rechazada',
      color: 'bg-red-100 text-red-800',
      variant: 'outline',
      message: 'Su solicitud no pudo ser aprobada.',
    },
  };

  const currentStatus = stageConfig[stage];
  const eventName = data.event?.id ? `Evento #${data.event.id}` : 'Solicitud de Evento';
  const locationDisplay = data.location.type === 'SPACE' 
    ? data.location.spaceName || 'Espacio no especificado'
    : data.location.freeLocation || 'Ubicación no especificada';

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Seguimiento de Solicitud</h1>
        <p className="text-muted-foreground">
          Código: <code className="text-sm">{data.trackingUuid}</code>
        </p>
      </div>

      {/* Estado actual */}
      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">{eventName}</h2>
            <p className="text-sm text-muted-foreground">
              Enviada el {formatDate(data.request.submittedAt)}
            </p>
          </div>
          <Badge variant={currentStatus.variant} className={currentStatus.color}>
            {currentStatus.label}
          </Badge>
        </div>

        {/* Estado aprobado */}
        {stage === 'APPROVED' && (
          <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200">
            <AlertDescription>
              <p className="font-semibold text-green-800 dark:text-green-200">
                ✅ Solicitud aprobada
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Su evento fue aprobado y figura en el calendario público.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Estado rechazado */}
        {data.request.status === 'RECHAZADO' && data.timeline.some(t => t.type === 'COMMENT') && (
          <Alert variant="destructive">
            <AlertDescription>
              <p className="font-semibold mb-1">Solicitud rechazada</p>
              <p className="text-sm">
                {data.timeline.find(t => t.type === 'COMMENT')?.details || 'Sin comentarios'}
              </p>
            </AlertDescription>
          </Alert>
        )}
      </Card>

      {/* Detalles del evento */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Detalles del Evento</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fecha y horario */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Fecha y Horario</p>
            <p className="text-sm">
              {formatDate(data.schedule.date)}
              <br />
              {data.schedule.from} - {data.schedule.to}
            </p>
          </div>

          {/* Ubicación */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Ubicación</p>
            <p className="text-sm">{locationDisplay}</p>
          </div>

          {/* Última actualización */}
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-muted-foreground mb-1">Última Actualización</p>
            <p className="text-sm">
              {data.timeline.length > 0 ? formatDateTime(data.timeline[data.timeline.length - 1].at) : formatDateTime(data.request.submittedAt)}
            </p>
          </div>

          {/* Comentarios adicionales */}
          {data.timeline.filter(t => t.type === 'COMMENT' && data.request.status !== 'RECHAZADO').map((comment, idx) => (
            <div key={idx} className="md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground mb-1">Comentarios</p>
              <p className="text-sm">{comment.details}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Información adicional */}
      <Alert className="mb-6">
        <AlertDescription>
          <p className="text-sm">
            <strong>Estado actual:</strong> {currentStatus.label}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {currentStatus.message}
          </p>
        </AlertDescription>
      </Alert>

      {/* Acciones */}
      <div className="flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link to="/public/calendar">Ver Calendario Público</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/solicitud">Nueva Solicitud</Link>
        </Button>
      </div>
    </div>
  );
}

// ========== HELPERS ==========

function formatDate(isoString: string): string {

  const dateToFormat = isoString.includes('T') 
    ? new Date(isoString) 
    : new Date(isoString + 'T00:00:00');
  
  return dateToFormat.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

