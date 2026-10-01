import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCcw,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AppBreadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { eventsApi, publicRequestsApi } from '@/services/api';
import type { RequestHistoryEntry } from '@/services/api';
import { PublicRequestStatusBadge } from '@/features/publicRequests/components';
import { usePublicRequestsStore } from '@/store/publicRequests.store';
import {
  canConvertRequestToEvent,
  canMoveRequestToReview,
  canRejectRequest,
  getAudienceTypeLabel,
  getRequestLocationLabel,
  getRequestStatusDescription,
  type PublicEventRequest,
} from '@/models/public-request';
import { formatLocalDate } from '@/utils/dates';
import { getPriorityBadgeVariant, getPriorityLabel, getStatusBadgeVariant, getStatusLabel } from '@/features/events/utils/status-helpers';
import type { EventStatus } from '@/models/event-status';

interface GeneratedEventSummary {
  id: number;
  name: string;
  status: EventStatus;
}

export function PublicRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const requestId = id ? Number(id) : NaN;
  const invalidRequestId = !id || Number.isNaN(requestId);

  const {
    selectedRequest,
    loading,
    errors,
    fetchRequestById,
    changeRequestStatus,
    convertRequestToEvent,
    clearSelectedRequest,
  } = usePublicRequestsStore();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [history, setHistory] = useState<RequestHistoryEntry[]>([]);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertRequiresTech, setConvertRequiresTech] = useState(false);
  const [convertTechMode, setConvertTechMode] = useState<'SETUP_ONLY' | 'ATTENDED'>('SETUP_ONLY');
  const [generatedEvent, setGeneratedEvent] = useState<GeneratedEventSummary | null>(null);
  const [loadingGeneratedEvent, setLoadingGeneratedEvent] = useState(false);

  const loadRequest = useCallback(async () => {
    if (invalidRequestId) {
      return;
    }

    const request = await fetchRequestById(requestId);

    if (!request) {
      toast.error('No se pudo cargar la solicitud');
    }
  }, [fetchRequestById, invalidRequestId, requestId]);

  // Historial con actor y motivo; se recarga cuando cambia el estado de la solicitud.
  useEffect(() => {
    if (!requestId) return;
    publicRequestsApi
      .getAdminRequestHistory(requestId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [requestId, selectedRequest?.status]);

  useEffect(() => {
    if (invalidRequestId) {
      toast.error('ID de solicitud inválido');
      navigate('/solicitudes');
      return;
    }

    loadRequest();

    return () => {
      clearSelectedRequest();
    };
  }, [clearSelectedRequest, invalidRequestId, loadRequest, navigate]);

  useEffect(() => {
    if (!selectedRequest?.convertedEventId) {
      setGeneratedEvent(null);
      return;
    }

    let cancelled = false;

    setLoadingGeneratedEvent(true);

    eventsApi
      .getEventById(selectedRequest.convertedEventId)
      .then((event) => {
        if (cancelled) {
          return;
        }

        setGeneratedEvent({
          id: event.id,
          name: event.name,
          status: event.status,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setGeneratedEvent(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingGeneratedEvent(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRequest?.convertedEventId]);

  const handleMoveToReview = async () => {
    const updatedRequest = await changeRequestStatus(requestId, 'EN_REVISION');

    if (!updatedRequest) {
      toast.error('No se pudo pasar la solicitud a revisión', {
        description: errors.action || 'Intentá nuevamente.',
      });
      return;
    }

    toast.success('Solicitud actualizada', {
      description: 'La solicitud quedó en EN REVISION.',
    });
    await fetchRequestById(requestId);
  };

  const handleReject = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('Indicá el motivo del rechazo');
      return;
    }
    const updatedRequest = await changeRequestStatus(requestId, 'RECHAZADO', reason);

    if (!updatedRequest) {
      toast.error('No se pudo rechazar la solicitud', {
        description: errors.action || 'Intentá nuevamente.',
      });
      return;
    }

    setRejectDialogOpen(false);
    toast.success('Solicitud rechazada');
    await fetchRequestById(requestId);
  };

  const handleConvert = async () => {
    const result = await convertRequestToEvent(requestId, {
      requiresTech: convertRequiresTech,
      techSupportMode: convertRequiresTech ? convertTechMode : undefined,
    });

    if (!result) {
      toast.error('No se pudo convertir la solicitud', {
        description: errors.action || 'Intentá nuevamente.',
      });
      return;
    }

    setConvertDialogOpen(false);
    toast.success('Solicitud convertida a evento');
    navigate(`/events/${result.eventId}`);
  };

  const handleRefresh = async () => {
    await loadRequest();
  };

  if (loading.detail || !selectedRequest || selectedRequest.id !== requestId) {
    if (!loading.detail && (!selectedRequest || selectedRequest.id !== requestId)) {
      return (
        <div className="container mx-auto py-6">
          <Card className="mx-auto max-w-2xl">
            <CardContent className="space-y-4 pt-6">
              <div>
                <p className="font-medium">No se pudo cargar la solicitud.</p>
                <p className="text-sm text-muted-foreground">
                  {errors.detail || 'La solicitud no existe o no está disponible.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => navigate('/solicitudes')}>
                  Volver al listado
                </Button>
                <Button onClick={handleRefresh}>Reintentar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="container mx-auto py-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-muted-foreground">Cargando solicitud...</p>
          </div>
        </div>
      </div>
    );
  }

  const request = selectedRequest;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="space-y-4">
        <AppBreadcrumbs />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">
                {request.name || `Solicitud #${request.id}`}
              </h1>
              <p className="text-muted-foreground">
                Solicitud #{request.id} · Tracking {request.trackingUuid} · Creada el{' '}
                {formatDateTime(request.createdAt)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PublicRequestStatusBadge status={request.status} className="text-sm" />
              <Badge
                variant={getPriorityBadgeVariant(request.priority)}
                className={request.priority === 'HIGH' ? 'border-red-300 text-red-700 ring-red-200' : ''}
              >
                {getPriorityLabel(request.priority)}
              </Badge>
              <Badge variant="outline">{getAudienceTypeLabel(request.audienceType)}</Badge>
              {request.technicalSchedule ? (
                <Badge variant="outline">Técnica {request.technicalSchedule}</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/solicitudes')}>
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading.detail}>
              <RefreshCcw className={`h-4 w-4 ${loading.detail ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <SummaryBlock
                title="Fecha y horario"
                lines={[
                  formatLocalDate(request.date, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                  `${request.scheduleFrom} - ${request.scheduleTo}`,
                  request.technicalSchedule ? `Horario técnico: ${request.technicalSchedule}` : null,
                  buildBuffersLabel(request),
                ]}
              />

              <SummaryBlock
                title="Ubicación"
                lines={[
                  getRequestLocationLabel(request),
                  request.space?.capacity ? `Capacidad: ${request.space.capacity} personas` : null,
                  request.space ? 'Espacio interno' : request.freeLocation ? 'Ubicación libre' : null,
                ]}
              />

              <SummaryBlock
                title="Solicitante / Área"
                lines={[
                  request.contactName,
                  request.contactEmail,
                  request.contactPhone || null,
                  request.requestingDepartment?.name || 'Área no informada',
                ]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Solicitud</CardTitle>
              <CardDescription>Detalle recibido desde el formulario público.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DetailField label="Nombre / título" value={request.name} />
              <DetailField label="Audiencia" value={getAudienceTypeLabel(request.audienceType)} />
              <DetailField label="Prioridad" value={getPriorityLabel(request.priority)} />
              <DetailField label="Descripción / requerimientos" value={request.requirements} />
              <DetailField label="Cobertura" value={request.coverage} />
              <DetailField label="Observaciones" value={request.observations} />
              <DetailField
                label="Tracking UUID"
                value={request.trackingUuid}
                muted={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
              <CardDescription>Quién tomó cada decisión sobre esta solicitud y por qué.</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
              ) : (
                <ol className="space-y-3">
                  {history.map((entry) => (
                    <li key={entry.id} className="border-l-2 pl-3 text-sm">
                      <div className="font-medium">
                        {entry.fromValue ? `${entry.fromValue} → ${entry.toValue}` : entry.toValue}
                      </div>
                      <div className="text-muted-foreground">
                        {formatDateTime(entry.at)} ·{' '}
                        {entry.actor
                          ? `${entry.actor.name} ${entry.actor.lastName} (${entry.actor.username})`
                          : 'Solicitante (formulario público)'}
                      </div>
                      {entry.reason ? <div className="mt-1">Motivo: {entry.reason}</div> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estado y acciones</CardTitle>
              <CardDescription>Acciones administrativas disponibles para esta solicitud.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Estado actual</div>
                <PublicRequestStatusBadge status={request.status} className="text-base" />
                <p className="text-sm text-muted-foreground">
                  {getRequestStatusDescription(request.status)}
                </p>
              </div>

              {request.reviewedAt ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Pasó a revisión el {formatDateTime(request.reviewedAt)}
                  {request.reviewedBy ? ` por ${request.reviewedBy}` : ''}.
                </div>
              ) : null}

              {request.convertedAt ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Convertida el {formatDateTime(request.convertedAt)}
                  {request.convertedBy ? ` por ${request.convertedBy}` : ''}.
                </div>
              ) : null}

              <Separator />

              <div className="space-y-2">
                {canMoveRequestToReview(request.status) ? (
                  <Button
                    className="w-full justify-start"
                    onClick={handleMoveToReview}
                    disabled={loading.action}
                  >
                    Pasar a revisión
                  </Button>
                ) : null}

                {canConvertRequestToEvent(request.status) ? (
                  <Button
                    className="w-full justify-start"
                    onClick={() => setConvertDialogOpen(true)}
                    disabled={loading.action}
                  >
                    Convertir a evento
                  </Button>
                ) : null}

                {canRejectRequest(request.status) ? (
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={loading.action}
                  >
                    Rechazar
                  </Button>
                ) : null}

                {request.status === 'CONVERTIDO' && request.convertedEventId ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate(`/events/${request.convertedEventId}`)}
                  >
                    Ver evento
                  </Button>
                ) : null}

                {!canMoveRequestToReview(request.status) &&
                !canConvertRequestToEvent(request.status) &&
                !canRejectRequest(request.status) &&
                !(request.status === 'CONVERTIDO' && request.convertedEventId) ? (
                  <p className="text-sm text-muted-foreground">
                    No hay acciones mutantes disponibles para esta solicitud.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Información del sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SystemField label="Tracking UUID" value={request.trackingUuid} />
              <SystemField label="Fecha de creación" value={formatDateTime(request.createdAt)} />
              <SystemField label="Última actualización" value={formatDateTime(request.updatedAt)} />
              {request.reviewedBy ? (
                <SystemField label="Revisado por" value={request.reviewedBy} />
              ) : null}
              {request.convertedBy ? (
                <SystemField label="Convertido por" value={request.convertedBy} />
              ) : null}
            </CardContent>
          </Card>

          {request.status === 'CONVERTIDO' && request.convertedEventId ? (
            <Card>
              <CardHeader>
                <CardTitle>Evento generado</CardTitle>
                <CardDescription>Vínculo operativo creado a partir de esta solicitud.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SystemField label="ID del evento" value={`#${request.convertedEventId}`} />
                <SystemField
                  label="Nombre del evento"
                  value={
                    loadingGeneratedEvent
                      ? 'Cargando...'
                      : generatedEvent?.name || 'No disponible'
                  }
                />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Estado del evento</p>
                  {generatedEvent ? (
                    <Badge variant={getStatusBadgeVariant(generatedEvent.status)}>
                      {getStatusLabel(generatedEvent.status)}
                    </Badge>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {loadingGeneratedEvent ? 'Cargando...' : 'No disponible'}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate(`/events/${request.convertedEventId}`)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver evento
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
            <DialogDescription>
              La solicitud quedará rechazada y ya no podrá convertirse a evento. El motivo se
              comunica al solicitante por correo y en la página de seguimiento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <label htmlFor="reject-reason" className="text-sm font-medium">
              Motivo del rechazo <span className="text-destructive">*</span>
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              rows={4}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Ej.: el espacio solicitado está reservado para un acto institucional."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={loading.action}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={loading.action || !rejectReason.trim()}>
              {loading.action ? 'Procesando...' : 'Confirmar rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir solicitud a evento</DialogTitle>
            <DialogDescription>
              Se creará un evento a partir de esta solicitud, la solicitud quedará en estado
              CONVERTIDO, el evento nuevo se creará en estado EN_REVISION y cualquier
              ajuste posterior se hará desde el módulo de Eventos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="convert-requires-tech"
                checked={convertRequiresTech}
                onCheckedChange={(checked) => setConvertRequiresTech(checked === true)}
              />
              <Label htmlFor="convert-requires-tech">Requiere soporte técnico</Label>
            </div>
            {convertRequiresTech ? (
              <div className="space-y-1">
                <Label>Modalidad de soporte</Label>
                <Select
                  value={convertTechMode}
                  onValueChange={(value) => setConvertTechMode(value as 'SETUP_ONLY' | 'ATTENDED')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SETUP_ONLY">Sólo montaje</SelectItem>
                    <SelectItem value="ATTENDED">Asistencia durante el evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Requerimientos indicados por el solicitante: {request.requirements || 'ninguno'}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConvertDialogOpen(false)}
              disabled={loading.action}
            >
              Cancelar
            </Button>
            <Button onClick={handleConvert} disabled={loading.action}>
              {loading.action ? 'Procesando...' : 'Confirmar conversión'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryBlock({ title, lines }: { title: string; lines: Array<string | null> }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {lines.filter(Boolean).map((line, index) => (
        <p key={`${title}-${index}`} className="text-sm">
          {line}
        </p>
      ))}
    </div>
  );
}

function DetailField({
  label,
  value,
  muted = true,
}: {
  label: string;
  value: string | null;
  muted?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <p className={muted ? 'text-sm leading-relaxed text-muted-foreground' : 'text-sm leading-relaxed'}>
        {value?.trim() ? value : 'No informado'}
      </p>
    </div>
  );
}

function SystemField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function buildBuffersLabel(request: PublicEventRequest): string | null {
  const labels = [];

  if (request.bufferBeforeMin > 0) {
    labels.push(`Antes: ${request.bufferBeforeMin} min`);
  }

  if (request.bufferAfterMin > 0) {
    labels.push(`Después: ${request.bufferAfterMin} min`);
  }

  return labels.length > 0 ? labels.join(' · ') : null;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
