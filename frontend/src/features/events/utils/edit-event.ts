import type { ApiError } from '@/services/api/types/api.types';
import type { AvailabilityConflictResponse } from '@/services/api/types/backend.types';
import { extractConflictData } from '@/services/api/utils/error-handler';
import type { EventUpdatePatchInput } from '@/services/api/events.api';
import type { Event } from '@/models/event';
import type { EventStatus } from '@/models/event-status';
import type { EventFormValues } from '@/schemas/eventForm.schema';
import { toEventFormValues } from '@/schemas/eventForm.schema';

type ChangeImpact = 'none' | 'informative' | 'operational' | 'agenda';

const INFORMATIVE_FIELDS = new Set<keyof EventFormValues>([
  'name',
  'requirements',
  'coverage',
  'observations',
  'audienceType',
  'contactName',
  'contactEmail',
  'contactPhone',
  'departmentId',
]);

const OPERATIONAL_FIELDS = new Set<keyof EventFormValues>([
  'requiresTech',
  'techSupportMode',
  'technicalSchedule',
  'priority',
  'requestingArea',
  'internal',
  'bufferBeforeMin',
  'bufferAfterMin',
  'freeLocation',
]);

const AGENDA_FIELDS = new Set<keyof EventFormValues>([
  'date',
  'scheduleFrom',
  'scheduleTo',
  'spaceId',
]);

export const EDITABLE_EVENT_STATUSES: EventStatus[] = ['EN_REVISION', 'RESERVADO'];

export const EVENT_FIELD_LABELS: Record<keyof EventFormValues, string> = {
  name: 'Nombre',
  departmentId: 'Departamento',
  requestingArea: 'Área solicitante',
  priority: 'Prioridad',
  audienceType: 'Tipo de audiencia',
  internal: 'Tipo de evento',
  date: 'Fecha',
  scheduleFrom: 'Hora de inicio',
  scheduleTo: 'Hora de fin',
  spaceId: 'Espacio',
  freeLocation: 'Ubicación libre',
  bufferBeforeMin: 'Buffer previo',
  bufferAfterMin: 'Buffer posterior',
  requiresTech: 'Soporte técnico',
  techSupportMode: 'Modo técnico',
  technicalSchedule: 'Horario técnico',
  requirements: 'Requerimientos',
  coverage: 'Cobertura',
  observations: 'Observaciones',
  contactName: 'Contacto',
  contactEmail: 'Email de contacto',
  contactPhone: 'Teléfono de contacto',
};

export interface ClassifiedEventChanges {
  hasChanges: boolean;
  impact: ChangeImpact;
  changedFields: Array<keyof EventFormValues>;
  changedFieldLabels: string[];
  informativeFields: Array<keyof EventFormValues>;
  operationalFields: Array<keyof EventFormValues>;
  agendaFields: Array<keyof EventFormValues>;
}

export interface MappedUpdateError {
  title: string;
  description: string;
  type:
    | 'availability'
    | 'priority-tie'
    | 'tech-capacity'
    | 'validation'
    | 'domain'
    | 'generic';
  conflictData?: AvailabilityConflictResponse;
  fieldErrors?: Partial<Record<keyof EventFormValues, string>>;
}

export function isEditableEventStatus(status: string | null | undefined): status is EventStatus {
  return status === 'EN_REVISION' || status === 'RESERVADO';
}

export function getEditBlockReason(status: string | null | undefined): string {
  switch (status) {
    case 'APROBADO':
      return 'Este evento está APROBADO. Para editarlo primero debés cambiar su estado a EN_REVISION.';
    case 'RECHAZADO':
      return 'Este evento está RECHAZADO y no puede editarse desde la UI.';
    default:
      return 'Este evento no puede editarse en su estado actual.';
  }
}

export function getEventLocationType(values: Pick<EventFormValues, 'spaceId' | 'freeLocation'>): 'space' | 'free' {
  return values.spaceId !== null ? 'space' : 'free';
}

export function mapEventToFormValues(event: Event): EventFormValues {
  return toEventFormValues(event);
}

export function classifyEventChanges(event: Event, values: EventFormValues): ClassifiedEventChanges {
  const original = mapEventToFormValues(event);
  const changedFields = (Object.keys(EVENT_FIELD_LABELS) as Array<keyof EventFormValues>).filter(
    (field) => original[field] !== values[field]
  );

  const informativeFields = changedFields.filter((field) => INFORMATIVE_FIELDS.has(field));
  const operationalFields = changedFields.filter((field) => OPERATIONAL_FIELDS.has(field));
  const agendaFields = changedFields.filter((field) => AGENDA_FIELDS.has(field));

  let impact: ChangeImpact = 'none';
  if (agendaFields.length > 0) {
    impact = 'agenda';
  } else if (operationalFields.length > 0) {
    impact = 'operational';
  } else if (informativeFields.length > 0) {
    impact = 'informative';
  }

  return {
    hasChanges: changedFields.length > 0,
    impact,
    changedFields,
    changedFieldLabels: changedFields.map((field) => EVENT_FIELD_LABELS[field]),
    informativeFields,
    operationalFields,
    agendaFields,
  };
}

export function buildUpdatePayload(event: Event, values: EventFormValues): EventUpdatePatchInput {
  const original = mapEventToFormValues(event);
  const payload: EventUpdatePatchInput = {};
  const originalSpaceId = event.spaceId ?? event.space?.id ?? null;

  if (original.name !== values.name) payload.name = values.name.trim();
  if (original.departmentId !== values.departmentId && values.departmentId !== null) payload.departmentId = values.departmentId;
  if (original.requestingArea !== values.requestingArea) payload.requestingArea = values.requestingArea.trim();
  if (original.priority !== values.priority) payload.priority = values.priority;
  if (original.internal !== values.internal) payload.internal = values.internal;
  if (original.date !== values.date) payload.date = values.date;
  if (original.scheduleFrom !== values.scheduleFrom) payload.scheduleFrom = values.scheduleFrom;
  if (original.scheduleTo !== values.scheduleTo) payload.scheduleTo = values.scheduleTo;
  if (original.spaceId !== values.spaceId && values.spaceId !== null) payload.spaceId = values.spaceId;
  if (original.freeLocation !== values.freeLocation && !(originalSpaceId && values.freeLocation.trim() !== '')) {
    payload.freeLocation = values.freeLocation;
  }
  if (original.bufferBeforeMin !== values.bufferBeforeMin) payload.bufferBeforeMin = values.bufferBeforeMin;
  if (original.bufferAfterMin !== values.bufferAfterMin) payload.bufferAfterMin = values.bufferAfterMin;
  if (original.requiresTech !== values.requiresTech) payload.requiresTech = values.requiresTech;
  if (original.requirements !== values.requirements) payload.requirements = values.requirements.trim();
  if (original.coverage !== values.coverage) payload.coverage = values.coverage.trim();
  if (original.observations !== values.observations) payload.observations = values.observations.trim();
  if (original.contactName !== values.contactName) payload.contactName = values.contactName.trim();
  if (original.contactEmail !== values.contactEmail) payload.contactEmail = values.contactEmail.trim();
  if (original.contactPhone !== values.contactPhone) payload.contactPhone = values.contactPhone.trim();

  if (original.audienceType !== values.audienceType && !(event.audienceType && values.audienceType === '')) {
    payload.audienceType = values.audienceType === '' ? null : values.audienceType;
  }

  if (original.techSupportMode !== values.techSupportMode || original.requiresTech !== values.requiresTech) {
    payload.techSupportMode = values.requiresTech ? (values.techSupportMode === '' ? null : values.techSupportMode) : null;
  }

  if (original.technicalSchedule !== values.technicalSchedule && !(event.technicalSchedule && values.technicalSchedule === '')) {
    payload.technicalSchedule = values.technicalSchedule === '' ? null : values.technicalSchedule;
  }

  if (!values.requiresTech) {
    payload.techSupportMode = null;
  }

  return payload;
}

export function mapUpdateError(error: unknown): MappedUpdateError {
  const conflictData = extractConflictData(error);
  if (conflictData) {
    return {
      type: 'availability',
      title: 'Conflicto de disponibilidad',
      description:
        'El espacio no está disponible para la fecha y horario elegidos. Revisá el detalle del conflicto antes de guardar nuevamente.',
      conflictData,
    };
  }

  const apiError = error as Partial<ApiError> | undefined;
  const details = apiError?.details as
    | { error?: string; errors?: Partial<Record<keyof EventFormValues, string>> }
    | undefined;

  if (apiError?.status === 409 && (apiError.code === 'PRIORITY_TIE' || apiError.message === 'PRIORITY_TIE')) {
    return {
      type: 'priority-tie',
      title: 'Conflicto de prioridad',
      description:
        'Existe un empate de prioridad alta con otro evento. La resolución debe hacerse manualmente desde la gestión operativa.',
    };
  }

  if (apiError?.status === 409 && (apiError.code === 'TECH_CAPACITY_REACHED' || details?.error === 'TECH_CAPACITY_REACHED')) {
    return {
      type: 'tech-capacity',
      title: 'Capacidad técnica agotada',
      description:
        apiError.message || 'No hay capacidad técnica disponible para el rango solicitado.',
    };
  }

  if (apiError?.status === 400 && details?.errors) {
    return {
      type: 'validation',
      title: 'Hay campos para revisar',
      description: 'Corregí los errores marcados en el formulario antes de volver a guardar.',
      fieldErrors: details.errors,
    };
  }

  if (apiError?.status === 400) {
    return {
      type: 'domain',
      title: 'No se pudieron guardar los cambios',
      description: apiError.message || 'Revisá la configuración del evento y volvé a intentar.',
    };
  }

  return {
    type: 'generic',
    title: 'Error al guardar cambios',
    description: apiError?.message || 'Ocurrió un error inesperado al actualizar el evento.',
  };
}
