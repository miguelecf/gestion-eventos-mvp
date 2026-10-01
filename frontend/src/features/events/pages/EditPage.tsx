import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { AppBreadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EventFormSections from '@/features/events/components/EventFormSections';
import ConflictAlert from '@/features/events/components/ConflictAlert';
import {
  buildUpdatePayload,
  classifyEventChanges,
  getEditBlockReason,
  getEventLocationType,
  isEditableEventStatus,
  mapEventToFormValues,
  mapUpdateError,
  type ClassifiedEventChanges,
  type MappedUpdateError,
} from '@/features/events/utils/edit-event';
import { getStatusBadgeVariant, getStatusLabel } from '@/features/events/utils/status-helpers';
import type { Event } from '@/models/event';
import { editEventFormSchema, eventFormDefaults, type EventFormValues } from '@/schemas/eventForm.schema';
import { eventsApi } from '@/services/api';
import { useEventsStore } from '@/store';

export function EditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const conflictAlertRef = useRef<HTMLDivElement>(null);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationType, setLocationType] = useState<'space' | 'free'>('space');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<ClassifiedEventChanges | null>(null);
  const [inlineError, setInlineError] = useState<MappedUpdateError | null>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(editEventFormSchema),
    defaultValues: eventFormDefaults,
  });

  const { getValues, handleSubmit, reset, setError, setValue } = form;

  const eventId = useMemo(() => {
    if (!id) {
      return null;
    }

    const parsed = Number(id);
    return Number.isFinite(parsed) ? parsed : null;
  }, [id]);

  useEffect(() => {
    if (inlineError?.conflictData && conflictAlertRef.current) {
      setTimeout(() => {
        conflictAlertRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
    }
  }, [inlineError]);

  useEffect(() => {
    if (!eventId) {
      toast.error('ID de evento inválido');
      navigate('/events', { replace: true });
      return;
    }

    let cancelled = false;

    const loadEvent = async () => {
      setLoading(true);
      try {
        const loadedEvent = await eventsApi.getEventById(eventId);
        if (cancelled) {
          return;
        }

        setEvent(loadedEvent);
        const formValues = mapEventToFormValues(loadedEvent);
        reset(formValues);
        setLocationType(getEventLocationType(formValues));
      } catch (error) {
        if (!cancelled) {
          const message =
            (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
              ? error.message
              : null) || 'No se pudo cargar el evento';
          toast.error('Evento no encontrado', {
            description: message,
          });
          navigate('/events', { replace: true });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadEvent();

    return () => {
      cancelled = true;
    };
  }, [eventId, navigate, reset]);

  const handleLocationTypeChange = (type: 'space' | 'free') => {
    setLocationType(type);

    if (type === 'space') {
      setValue('freeLocation', '');
    } else {
      setValue('spaceId', null);
    }
  };

  const runSubmit = async (values: EventFormValues, changes: ClassifiedEventChanges) => {
    if (!event) {
      return;
    }

    setSaving(true);
    setInlineError(null);

    try {
      const updatedEvent = await eventsApi.updateEvent(event.id, buildUpdatePayload(event, values));
      setEvent(updatedEvent);
      useEventsStore.getState().fetchEvents(true);

      if (changes.impact === 'agenda' && event.status === 'RESERVADO' && updatedEvent.status === 'EN_REVISION') {
        toast.success('Evento actualizado', {
          description:
            'Se guardaron los cambios de agenda y el evento volvió a EN_REVISION para ser revisado nuevamente.',
        });
      } else if (changes.impact === 'operational') {
        toast.success('Evento actualizado', {
          description: 'Los cambios operativos fueron guardados correctamente.',
        });
      } else {
        toast.success('Evento actualizado correctamente');
      }

      navigate(`/events/${updatedEvent.id}`);
    } catch (error) {
      const mappedError = mapUpdateError(error);
      setInlineError(mappedError);

      if (mappedError.fieldErrors) {
        for (const [field, message] of Object.entries(mappedError.fieldErrors)) {
          if (!message) {
            continue;
          }

          setError(field as keyof EventFormValues, {
            type: 'server',
            message,
          });
        }
      }

      toast.error(mappedError.title, {
        description: mappedError.description,
      });
    } finally {
      setSaving(false);
      setDialogOpen(false);
      setPendingChanges(null);
    }
  };

  const requestSave = handleSubmit(async (values) => {
    if (!event) {
      return;
    }

    const changes = classifyEventChanges(event, values);
    if (!changes.hasChanges) {
      toast.info('No hay cambios para guardar');
      return;
    }

    if (changes.impact === 'informative') {
      await runSubmit(values, changes);
      return;
    }

    setPendingChanges(changes);
    setDialogOpen(true);
  });

  const confirmSave = async () => {
    if (!pendingChanges) {
      return;
    }

    await runSubmit(getValues(), pendingChanges);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-muted-foreground">Cargando evento...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const knownStatuses = ['EN_REVISION', 'RESERVADO', 'APROBADO', 'RECHAZADO'] as const;
  const hasKnownStatus = knownStatuses.includes(event.status);
  const blockedStatusLabel = hasKnownStatus ? getStatusLabel(event.status) : String(event.status);
  const blockedStatusVariant = hasKnownStatus ? getStatusBadgeVariant(event.status) : 'outline';

  if (!isEditableEventStatus(event.status)) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 py-6">
        <AppBreadcrumbs />

        <Card>
          <CardHeader>
            <CardTitle>Editar Evento</CardTitle>
            <CardDescription>La edición de este evento no está disponible en su estado actual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant={blockedStatusVariant}>{blockedStatusLabel}</Badge>
            <Alert>
              <AlertTitle>Edición bloqueada</AlertTitle>
              <AlertDescription>{getEditBlockReason(event.status)}</AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button onClick={() => navigate(`/events/${event.id}`)}>Volver al detalle</Button>
              <Button variant="outline" onClick={() => navigate('/events')}>
                Ir al listado
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allowAudienceTypeClear = !event.audienceType;
  const allowTechnicalScheduleClear = !event.technicalSchedule;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-6">
      <div className="space-y-4 px-4">
        <AppBreadcrumbs />

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Editar Evento</h1>
            <p className="text-muted-foreground">
              Modificá los datos estructurales y operativos del evento sin afectar la gestión operativa del detalle.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(event.status)}>{getStatusLabel(event.status)}</Badge>
            <Button variant="outline" onClick={() => navigate(`/events/${event.id}`)}>
              Volver al detalle
            </Button>
          </div>
        </div>

        {event.status === 'RESERVADO' ? (
          <Alert>
            <AlertTitle>Evento reservado</AlertTitle>
            <AlertDescription>
              Si modificás fecha, horario o espacio, el backend puede devolver el evento a EN_REVISION.
            </AlertDescription>
          </Alert>
        ) : null}

        {inlineError && inlineError.type !== 'availability' ? (
          <Alert variant="destructive">
            <AlertTitle>{inlineError.title}</AlertTitle>
            <AlertDescription>{inlineError.description}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <form onSubmit={requestSave} className="space-y-6 px-4">
        <EventFormSections
          form={form}
          mode="edit"
          locationType={locationType}
          onLocationTypeChange={handleLocationTypeChange}
          allowAudienceTypeClear={allowAudienceTypeClear}
          allowTechnicalScheduleClear={allowTechnicalScheduleClear}
          syncPriorityWithRequestingArea={true}
        />

        <div className="flex justify-end gap-4 border-t pt-6">
          <Button type="button" variant="outline" onClick={() => navigate(`/events/${event.id}`)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando cambios...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>

      {inlineError?.conflictData ? (
        <div ref={conflictAlertRef} className="px-4">
          <ConflictAlert conflictData={inlineError.conflictData} requestedSpaceId={getValues('spaceId') ?? undefined} />
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingChanges?.impact === 'agenda' ? 'Confirmar cambios de agenda' : 'Confirmar cambios operativos'}
            </DialogTitle>
            <DialogDescription>
              {pendingChanges?.impact === 'agenda'
                ? 'Estás modificando fecha, horario o espacio. Si el evento está RESERVADO, al guardar volverá a EN_REVISION y deberá revisarse nuevamente.'
                : 'Estás modificando información operativa del evento. Esto puede afectar técnica, prioridad, visibilidad o validaciones internas.'}
            </DialogDescription>
          </DialogHeader>

          {pendingChanges?.changedFieldLabels?.length ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Campos modificados: {pendingChanges.changedFieldLabels.join(', ')}.
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={confirmSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Confirmar y guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EditPage;
