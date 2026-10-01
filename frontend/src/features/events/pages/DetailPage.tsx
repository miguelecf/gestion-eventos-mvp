import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AppBreadcrumbs } from '@/components/breadcrumbs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useEvents } from '@/hooks/api';
import type { Event, User } from '@/models/event';
import type { EventStatus } from '@/models/event-status';
import type { Comment } from '@/services/api/comments.api';
import { formatLocalDate } from '@/utils/dates';
import { EventApprovalHistory } from '@/features/events/components/EventApprovalHistory';
import { EventAuditSection } from '@/features/events/components/EventAuditSection';
import { EventOperationalCard } from '@/features/events/components/EventOperationalCard';
import { EventOriginCard } from '@/features/events/components/EventOriginCard';
import { EventSectionErrorState } from '@/features/events/components/EventSectionErrorState';
import { useEventAudit } from '@/features/events/hooks/useEventAudit';
import { useEventComments } from '@/features/events/hooks/useEventComments';
import { useEventPermissions } from '@/features/events/hooks/useEventPermissions';
import { useEventStatusManager } from '@/features/events/hooks/useEventStatusManager';
import { useTechCapacityStatus } from '@/features/events/hooks/useTechCapacityStatus';
import {
  ApprovalBadge,
  formatMissingApprovals,
  getApprovalStatusMessage,
} from '@/features/events/utils/approval-helpers';
import { getEditBlockReason } from '@/features/events/utils/edit-event';
import {
  canEditEvent as canEditEventForStatus,
  getAudienceTypeLabel,
  getPriorityLabel,
  getStatusBadgeVariant,
  getStatusDescription,
  getStatusLabel,
} from '@/features/events/utils/status-helpers';

interface EventLoadOptions {
  keepCurrent?: boolean;
}

export function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const parsedEventId = id ? Number.parseInt(id, 10) : Number.NaN;
  const isInvalidEventId = !id || Number.isNaN(parsedEventId);
  const eventId = isInvalidEventId ? 0 : parsedEventId;

  const [event, setEvent] = useState<Event | null>(null);
  const [hasAttemptedInitialLoad, setHasAttemptedInitialLoad] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [showApprovalHistory, setShowApprovalHistory] = useState(false);
  const [pendingApprovalInfo, setPendingApprovalInfo] = useState<{ missing: string[] } | null>(null);

  const {
    fetchEventById,
    loading: loadingEvent,
    error: eventError,
    clearError: clearEventError,
  } = useEvents();

  const permissions = useEventPermissions(event);
  const canManageWorkflow = permissions.canManageStatus || permissions.canApprove;

  const {
    currentStatus,
    allowedTransitions,
    changeStatus,
    changing: changingStatus,
    refetch: refetchStatus,
    requiresReasonFor,
    getTransitionMessageFor,
    error: statusError,
    clearError: clearStatusError,
  } = useEventStatusManager({
    eventId,
    autoLoad: !isInvalidEventId && canManageWorkflow,
  });

  const {
    comments,
    loading: loadingComments,
    error: commentsError,
    submitting: submittingComment,
    addComment,
    updateComment,
    deleteComment,
    hasMore: hasMoreComments,
    loadMoreComments,
    refreshComments,
    clearError: clearCommentsError,
  } = useEventComments(eventId, {
    autoLoad: !isInvalidEventId && permissions.canViewComments,
    sortOrder: 'DESC',
  });

  const {
    entries: auditEntries,
    approvalEntries,
    loading: loadingAudit,
    error: auditError,
    hasMore: hasMoreAudit,
    refreshAudit,
    loadMoreAudit,
    clearError: clearAuditError,
  } = useEventAudit(eventId, {
    autoLoad: !isInvalidEventId && permissions.canViewAudit,
  });

  const {
    isSaturated: techCapacitySaturated,
    loading: loadingTechCapacity,
    error: techCapacityError,
    saturatedBlocks,
  } = useTechCapacityStatus(
    event?.date ?? null,
    event?.scheduleFrom ?? null,
    event?.scheduleTo ?? null,
    Boolean(event?.requiresTech) && permissions.canViewTechCapacity,
    {
      bufferBeforeMin: event?.bufferBeforeMin,
      bufferAfterMin: event?.bufferAfterMin,
      techSupportMode: event?.techSupportMode,
    }
  );

  const displayStatus = currentStatus ?? event?.status ?? null;
  const showApprovals = Boolean(event);
  const canEditCurrentEvent = Boolean(event && canEditEventForStatus(event.status));

  const eventErrorState = useMemo(() => {
    if (isInvalidEventId) {
      return {
        title: 'ID de evento invalido',
        message: 'La URL no contiene un identificador numerico valido para abrir este evento.',
        isNotFound: false,
      };
    }

    if (!hasAttemptedInitialLoad || loadingEvent || event) {
      return null;
    }

    if (eventError?.statusCode === 404) {
      return {
        title: 'Evento no encontrado',
        message: 'El evento solicitado no existe o ya no esta disponible.',
        isNotFound: true,
      };
    }

    return {
      title: 'No se pudo cargar el evento',
      message: eventError?.message || 'Ocurrio un error al cargar el detalle del evento.',
      isNotFound: false,
    };
  }, [event, eventError?.message, eventError?.statusCode, hasAttemptedInitialLoad, isInvalidEventId, loadingEvent]);

  const loadEvent = useCallback(async (options: EventLoadOptions = {}) => {
    const { keepCurrent = false } = options;

    if (isInvalidEventId) {
      setHasAttemptedInitialLoad(true);
      return false;
    }

    clearEventError();

    const data = await fetchEventById(eventId);
    setHasAttemptedInitialLoad(true);

    if (data) {
      setEvent(data);
      return true;
    }

    if (!keepCurrent) {
      setEvent(null);
    }

    return false;
  }, [clearEventError, eventId, fetchEventById, isInvalidEventId]);

  const refreshAuditIfVisible = useCallback(async () => {
    if (!permissions.canViewAudit) {
      return;
    }

    await refreshAudit();
  }, [permissions.canViewAudit, refreshAudit]);

  useEffect(() => {
    if (isInvalidEventId) {
      setHasAttemptedInitialLoad(true);
      setEvent(null);
      return;
    }

    setHasAttemptedInitialLoad(false);
    setEvent(null);
    void loadEvent();
  }, [isInvalidEventId, loadEvent]);

  const handleRetryEventLoad = useCallback(() => {
    setHasAttemptedInitialLoad(false);
    setEvent(null);
    void loadEvent();
  }, [loadEvent]);

  const handleNavigateToRequest = useCallback((requestId: number) => {
    navigate(`/solicitudes/${requestId}`);
  }, [navigate]);

  const handleStatusDialogChange = useCallback((open: boolean) => {
    setShowStatusDialog(open);

    if (!open) {
      setSelectedStatus(null);
      setStatusReason('');
      clearStatusError();
    }
  }, [clearStatusError]);

  const handleOpenStatusDialog = useCallback((targetStatus: EventStatus) => {
    clearStatusError();
    setSelectedStatus(targetStatus);
    setStatusReason('');
    setShowStatusDialog(true);
  }, [clearStatusError]);

  const handleConfirmStatusChange = useCallback(async () => {
    if (!selectedStatus) {
      return;
    }

    if (requiresReasonFor(selectedStatus) && !statusReason.trim()) {
      toast.error('Debes ingresar un motivo para esta transicion.');
      return;
    }

    const result = await changeStatus({
      to: selectedStatus,
      reason: statusReason.trim() || undefined,
    });

    if (!result) {
      return;
    }

    if (result.approvalPending) {
      setPendingApprovalInfo({ missing: result.missingApprovals });
      toast.warning('Se registro una aprobacion parcial.', {
        description: `Faltan: ${formatMissingApprovals(result.missingApprovals)}`,
      });
    } else {
      setPendingApprovalInfo(null);
      toast.success('Estado actualizado.', {
        description: `Nuevo estado: ${getStatusLabel(result.newStatus)}`,
      });
    }

    setSelectedStatus(null);
    setStatusReason('');
    setShowStatusDialog(false);

    await Promise.all([
      loadEvent({ keepCurrent: true }),
      refreshAuditIfVisible(),
    ]);
  }, [
    changeStatus,
    loadEvent,
    refreshAuditIfVisible,
    requiresReasonFor,
    selectedStatus,
    statusReason,
  ]);

  const handleCommentSubmit = useCallback(async (body: string) => {
    const success = await addComment(body);

    if (!success) {
      return false;
    }

    toast.success('Comentario agregado.');
    await refreshAuditIfVisible();
    return true;
  }, [addComment, refreshAuditIfVisible]);

  const handleCommentDelete = useCallback(async (commentId: number) => {
    const confirmed = window.confirm('Eliminar este comentario?');

    if (!confirmed) {
      return;
    }

    const success = await deleteComment(commentId);

    if (!success) {
      return;
    }

    toast.success('Comentario eliminado.');
    await refreshAuditIfVisible();
  }, [deleteComment, refreshAuditIfVisible]);

  const handleCommentUpdate = useCallback(async (commentId: number, body: string) => {
    const success = await updateComment(commentId, body);
    if (success) {
      toast.success('Comentario actualizado.');
      await refreshAuditIfVisible();
    }
    return success;
  }, [updateComment, refreshAuditIfVisible]);

  const handleCommentRetry = useCallback(async () => {
    clearCommentsError();
    await refreshComments();
  }, [clearCommentsError, refreshComments]);

  const handleAuditRetry = useCallback(async () => {
    clearAuditError();
    await refreshAudit();
  }, [clearAuditError, refreshAudit]);

  if (!hasAttemptedInitialLoad && loadingEvent) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex min-h-[18rem] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">Cargando evento...</p>
          </div>
        </div>
      </div>
    );
  }

  if (eventErrorState) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <AppBreadcrumbs />
        <Card>
          <CardHeader>
            <CardTitle>{eventErrorState.title}</CardTitle>
            <CardDescription>{eventErrorState.message}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {!isInvalidEventId ? (
              <Button type="button" onClick={handleRetryEventLoad}>
                Reintentar
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => navigate('/events')}>
              Volver a eventos
            </Button>
            {eventErrorState.isNotFound ? (
              <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                Volver atras
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-4">
        <AppBreadcrumbs />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
              {displayStatus ? (
                <Badge variant={getStatusBadgeVariant(displayStatus)} className="text-sm">
                  {getStatusLabel(displayStatus)}
                </Badge>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground">
              Evento #{event.id} - Creado el {formatDateTime(event.createdAt)}
            </p>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{event.internal ? 'Interno' : 'Publico'}</Badge>
              {event.requiresTech ? <Badge variant="outline">Requiere tecnica</Badge> : null}
              {event.requiresRebooking ? (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-600">
                  Requiere reprogramacion
                </Badge>
              ) : null}
              <Badge variant="outline">{getPriorityLabel(event.priority)}</Badge>
              <Badge variant="outline">{getAudienceTypeLabel(event.audienceType)}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {permissions.canUpdateEvent ? (
              <Button
                type="button"
                variant="outline"
                disabled={!canEditCurrentEvent}
                title={canEditCurrentEvent ? 'Editar evento' : getEditBlockReason(event.status)}
                onClick={() => navigate(`/events/${event.id}/edit`)}
              >
                Editar evento
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => navigate('/events')}>
              Volver
            </Button>
          </div>
        </div>

        {pendingApprovalInfo ? (
          <Alert>
            <AlertTitle>Aprobacion parcial registrada</AlertTitle>
            <AlertDescription className="flex w-full items-start justify-between gap-3">
              <p>Faltan: {formatMissingApprovals(pendingApprovalInfo.missing)}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPendingApprovalInfo(null)}
              >
                Cerrar
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <InfoField
                label="Fecha"
                value={formatLocalDate(event.date, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                description={`${event.scheduleFrom} - ${event.scheduleTo}`}
              />
              <InfoField
                label="Espacio"
                value={event.space?.name || event.freeLocation || 'Sin asignar'}
                description={
                  event.space?.capacity
                    ? `Capacidad: ${event.space.capacity} personas`
                    : undefined
                }
              />
              <InfoField
                label="Area organizadora"
                value={event.department?.name || event.requestingArea || 'No especificada'}
                description={event.createdBy ? `Creado por ${formatUserName(event.createdBy)}` : undefined}
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
              <CardTitle>Informacion del evento</CardTitle>
              <CardDescription>Resumen funcional y datos de contacto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {event.observations ? (
                <ContentBlock title="Observaciones" value={event.observations} />
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InfoField label="Prioridad" value={getPriorityLabel(event.priority)} />
                <InfoField label="Audiencia" value={getAudienceTypeLabel(event.audienceType)} />
                {event.requestingArea ? (
                  <InfoField label="Area solicitante" value={event.requestingArea} />
                ) : null}
                {event.department?.name ? (
                  <InfoField label="Departamento" value={event.department.name} />
                ) : null}
                {event.contactName ? (
                  <InfoField label="Contacto" value={event.contactName} />
                ) : null}
                {event.contactEmail ? (
                  <InfoField label="Email" value={event.contactEmail} />
                ) : null}
                {event.contactPhone ? (
                  <InfoField label="Telefono" value={event.contactPhone} />
                ) : null}
              </div>

              {event.requirements ? (
                <ContentBlock title="Requerimientos" value={event.requirements} />
              ) : null}

              {event.coverage ? (
                <ContentBlock title="Cobertura" value={event.coverage} />
              ) : null}
            </CardContent>
          </Card>

          {permissions.canViewAudit ? (
            <Card>
              <CardHeader>
                <CardTitle>Historial del evento</CardTitle>
                <CardDescription>
                  Acciones registradas, cambios de estado, comentarios y decisiones operativas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventAuditSection
                  entries={auditEntries}
                  loading={loadingAudit}
                  error={auditError}
                  hasMore={hasMoreAudit}
                  onRetry={handleAuditRetry}
                  onLoadMore={loadMoreAudit}
                />
              </CardContent>
            </Card>
          ) : null}

          {permissions.canViewComments ? (
            <Card>
              <CardHeader>
                <CardTitle>Comentarios internos</CardTitle>
                <CardDescription>Notas y conversaciones administrativas del evento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {permissions.canCreateComment ? (
                  <CommentForm onSubmit={handleCommentSubmit} submitting={submittingComment} />
                ) : null}

                {permissions.canCreateComment ? <Separator /> : null}

                {commentsError && comments.length > 0 ? (
                  <EventSectionErrorState
                    title="No se pudieron refrescar los comentarios"
                    message={commentsError}
                    onRetry={handleCommentRetry}
                  />
                ) : null}

                {commentsError && comments.length === 0 ? (
                  <EventSectionErrorState
                    title="No se pudieron cargar los comentarios"
                    message={commentsError}
                    onRetry={handleCommentRetry}
                  />
                ) : loadingComments && comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Cargando comentarios...</p>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay comentarios internos registrados todavia.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        canManage={permissions.canManageComment(comment)}
                        busy={submittingComment}
                        onDelete={() => handleCommentDelete(comment.id)}
                        onSave={(body) => handleCommentUpdate(comment.id, body)}
                      />
                    ))}
                  </div>
                )}

                {hasMoreComments ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loadingComments}
                    onClick={loadMoreComments}
                  >
                    {loadingComments ? 'Cargando...' : 'Cargar mas comentarios'}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {showApprovals ? (
            <Card>
              <CardHeader>
                <CardTitle>Conformidades</CardTitle>
                <CardDescription>Estado actual e historial de aprobaciones del evento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <ApprovalBadge type="ceremonial" approved={event.ceremonialOk} />
                  <ApprovalBadge type="technical" approved={event.technicalOk} />
                </div>

                <p className="text-sm text-muted-foreground">
                  {getApprovalStatusMessage(event.ceremonialOk, event.technicalOk)}
                </p>

                {permissions.canViewAudit ? (
                  <Collapsible open={showApprovalHistory} onOpenChange={setShowApprovalHistory}>
                    <Separator />
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" className="w-full justify-between px-0">
                        <span>Historial de aprobaciones</span>
                        <span>{showApprovalHistory ? 'Ocultar' : 'Ver detalle'}</span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <EventApprovalHistory
                        entries={approvalEntries}
                        loading={loadingAudit}
                        error={auditError}
                        hasMore={hasMoreAudit}
                        onRetry={handleAuditRetry}
                        onLoadMore={loadMoreAudit}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    El historial de aprobaciones solo esta disponible para perfiles operativos.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Estado y acciones</CardTitle>
              <CardDescription>Estado funcional actual del evento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Estado actual</Label>
                {displayStatus ? (
                  <>
                    <Badge variant={getStatusBadgeVariant(displayStatus)} className="text-sm">
                      {getStatusLabel(displayStatus)}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {getStatusDescription(displayStatus)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin informacion de estado.</p>
                )}
              </div>

              {!showStatusDialog && statusError ? (
                <EventSectionErrorState
                  title="No se pudo cargar el flujo de estados"
                  message={statusError}
                  onRetry={() => {
                    clearStatusError();
                    void refetchStatus();
                  }}
                />
              ) : null}

              {canManageWorkflow ? (
                <>
                  <Separator />
                  {allowedTransitions.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Cambiar estado</Label>
                      {allowedTransitions.map((targetStatus) => (
                        <Button
                          key={targetStatus}
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                          disabled={changingStatus}
                          onClick={() => handleOpenStatusDialog(targetStatus)}
                        >
                          {targetStatus === 'APROBADO'
                            ? 'Aprobar (requiere conformidades)'
                            : getStatusLabel(targetStatus)}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No hay transiciones disponibles para tu perfil o para el estado actual.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tu perfil no puede gestionar cambios de estado desde esta pantalla.
                </p>
              )}
            </CardContent>
          </Card>

          <EventOriginCard
            event={event}
            canNavigateToRequest={permissions.canReadPublicRequest}
            onNavigateToRequest={handleNavigateToRequest}
          />

          <EventOperationalCard
            event={event}
            techCapacitySaturated={techCapacitySaturated}
            saturatedBlocks={saturatedBlocks}
          />

          {techCapacityError && permissions.canViewTechCapacity ? (
            <EventSectionErrorState
              title="No se pudo cargar la capacidad tecnica"
              message={techCapacityError}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Informacion del sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoField label="Creado" value={formatDateTime(event.createdAt)} />
              <InfoField label="Ultima actualizacion" value={formatDateTime(event.updatedAt)} />
              {event.createdBy ? (
                <InfoField label="Creado por" value={formatUserName(event.createdBy)} />
              ) : null}
              {event.lastModifiedBy ? (
                <InfoField label="Ultima modificacion por" value={formatUserName(event.lastModifiedBy)} />
              ) : null}
              {loadingTechCapacity && event.requiresTech && permissions.canViewTechCapacity ? (
                <p className="text-xs text-muted-foreground">Actualizando capacidad tecnica...</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showStatusDialog} onOpenChange={handleStatusDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado del evento</DialogTitle>
            <DialogDescription>
              {selectedStatus && displayStatus ? getTransitionMessageFor(selectedStatus) : 'Confirma la accion.'}
            </DialogDescription>
          </DialogHeader>

          {selectedStatus ? (
            <div className="space-y-2">
              <Label htmlFor="status-reason">
                {requiresReasonFor(selectedStatus) ? 'Motivo *' : 'Motivo (opcional)'}
              </Label>
              <textarea
                id="status-reason"
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
                disabled={changingStatus}
                placeholder="Detalla el motivo o contexto de este cambio"
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {requiresReasonFor(selectedStatus) ? (
                <p className="text-xs text-muted-foreground">
                  Este cambio exige un motivo para quedar auditado correctamente.
                </p>
              ) : null}
            </div>
          ) : null}

          {statusError ? (
            <EventSectionErrorState
              title="No se pudo completar el cambio"
              message={statusError}
              onRetry={handleConfirmStatusChange}
            />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleStatusDialogChange(false)} disabled={changingStatus}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmStatusChange} disabled={changingStatus}>
              {changingStatus ? 'Procesando...' : 'Confirmar cambio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface InfoFieldProps {
  label: string;
  value: string;
  description?: string;
}

function InfoField({ label, value, description }: InfoFieldProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function ContentBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

interface CommentFormProps {
  onSubmit: (body: string) => Promise<boolean>;
  submitting: boolean;
}

function CommentForm({ onSubmit, submitting }: CommentFormProps) {
  const [body, setBody] = useState('');

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedBody = body.trim();

    if (!trimmedBody) {
      toast.error('El comentario no puede estar vacio.');
      return;
    }

    const success = await onSubmit(trimmedBody);

    if (success) {
      setBody('');
    }
  }, [body, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="event-comment">Nuevo comentario</Label>
        <textarea
          id="event-comment"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Escribe un comentario interno"
          disabled={submitting}
          className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <Button type="submit" disabled={submitting || !body.trim()}>
        {submitting ? 'Publicando...' : 'Publicar comentario'}
      </Button>
    </form>
  );
}

interface CommentItemProps {
  comment: Comment;
  /** Autor o rol privilegiado: misma regla que el backend para editar/eliminar. */
  canManage: boolean;
  busy: boolean;
  onDelete: () => void;
  onSave: (body: string) => Promise<boolean>;
}

function CommentItem({ comment, canManage, busy, onDelete, onSave }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  const handleSave = async () => {
    const body = draft.trim();
    if (!body || body === comment.body) {
      setEditing(false);
      return;
    }
    if (await onSave(body)) {
      setEditing(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{comment.author.fullName}</p>
            {comment.author.username ? (
              <Badge variant="outline" className="text-[10px]">
                @{comment.author.username}
              </Badge>
            ) : null}
            <Badge variant="outline" className="text-[10px]">
              {comment.visibility === 'INTERNAL' ? 'Interno' : 'Publico'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(comment.createdAt)}
            {comment.isEdited && comment.updatedAt ? ` - Editado ${formatDateTime(comment.updatedAt)}` : ''}
            {comment.editedBy ? ` - por ${comment.editedBy.fullName}` : ''}
          </p>
        </div>

        {canManage && !editing ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setDraft(comment.body);
                setEditing(true);
              }}
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive"
            >
              Eliminar
            </Button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2500}
            disabled={busy}
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={busy || !draft.trim()} onClick={() => void handleSave()}>
              {busy ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p>
      )}
    </div>
  );
}

function formatDateTime(date: string | Date): string {
  const value = typeof date === 'string' ? new Date(date) : date;

  return value.toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatUserName(user: User): string {
  return [user.name, user.lastName].filter(Boolean).join(' ').trim() || user.username;
}
