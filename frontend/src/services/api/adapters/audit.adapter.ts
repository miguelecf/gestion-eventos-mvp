/**
 * ===================================================================
 * ADAPTADOR DE AUDITORÍA
 * ===================================================================
 * Transforma BackendAuditEntryDTO <-> AuditEntry (modelo del frontend)
 * Alineado con HistoryType del backend actual.
 * ===================================================================
 */

import type {
  BackendAuditEntryDTO,
  BackendAuditPage,
  AuditActionType,
} from '../types/backend.types';
import type { PageResponse } from '../types/pagination.types';

export interface AuditEntry {
  id: number;
  actionType: AuditActionType;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  details: string | null;
  reason: string | null;
  note: string | null;
  actor: {
    id: number;
    username: string | null;
    fullName: string;
    email: string | null;
  } | null;
  timestamp: Date;
  description: string;
  icon: string;
  color: string;
}

function parseJsonDetails(details: string | null): Record<string, unknown> | null {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getNestedObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getCommentVisibilityLabel(value: unknown): string | null {
  switch (value) {
    case 'INTERNAL':
      return 'Interno';
    case 'PUBLIC':
      return 'Publico';
    default:
      return null;
  }
}

function normalizeActionType(entry: BackendAuditEntryDTO): AuditActionType {
  const actionType = entry.type ?? entry.actionType;

  if (!actionType) {
    throw new Error(`Entrada de auditoría ${entry.id} sin tipo`);
  }

  return actionType;
}

function normalizeTimestamp(entry: BackendAuditEntryDTO): Date {
  const rawValue = entry.at ?? entry.timestamp;

  if (!rawValue) {
    throw new Error(`Entrada de auditoría ${entry.id} sin fecha`);
  }

  return new Date(rawValue);
}

function normalizeActor(entry: BackendAuditEntryDTO): AuditEntry['actor'] {
  if (entry.actor) {
    return {
      id: entry.actor.id,
      username: entry.actor.username,
      fullName: `${entry.actor.name} ${entry.actor.lastName}`.trim(),
      email: entry.actor.email,
    };
  }

  if (
    entry.actorId === undefined &&
    !entry.actorUsername &&
    !entry.actorName &&
    !entry.actorLastName
  ) {
    return null;
  }

  return {
    id: entry.actorId ?? 0,
    username: entry.actorUsername ?? null,
    fullName: `${entry.actorName ?? ''} ${entry.actorLastName ?? ''}`.trim() || 'Usuario desconocido',
    email: null,
  };
}

function describeFieldUpdate(entry: BackendAuditEntryDTO): string {
  const field = entry.field ?? 'un campo';

  if (field === 'ceremonial_ok') {
    return entry.toValue === 'true'
      ? 'otorgó conformidad ceremonial'
      : 'revocó conformidad ceremonial';
  }

  if (field === 'technical_ok') {
    return entry.toValue === 'true'
      ? 'otorgó conformidad técnica'
      : 'revocó conformidad técnica';
  }

  return `actualizó ${field}`;
}

function describeComment(entry: BackendAuditEntryDTO, actionType: AuditActionType): string {
  const payload = parseJsonDetails(entry.details);
  const nextPayload = getNestedObject(payload?.next);
  const prevPayload = getNestedObject(payload?.prev);
  const nextBody = nextPayload?.body;
  const prevBody = prevPayload?.body;

  switch (actionType) {
    case 'COMMENT_CREATED':
      return typeof nextBody === 'string' ? `agregó comentario: "${nextBody}"` : 'agregó un comentario';
    case 'COMMENT_UPDATED':
      return typeof prevBody === 'string' && typeof nextBody === 'string'
        ? `editó comentario`
        : 'editó un comentario';
    case 'COMMENT_DELETED':
      return typeof prevBody === 'string' ? 'eliminó un comentario' : 'eliminó comentario';
    default:
      return 'gestionó un comentario';
  }
}

function normalizeCommentDetails(entry: BackendAuditEntryDTO): string | null {
  const payload = parseJsonDetails(entry.details);

  if (!payload) {
    return entry.details;
  }

  const nextPayload = getNestedObject(payload.next);
  const prevPayload = getNestedObject(payload.prev);
  const visibility = getCommentVisibilityLabel(
    nextPayload?.visibility ?? prevPayload?.visibility
  );

  if (visibility) {
    return `Visibilidad: ${visibility}`;
  }

  return null;
}

function describeInternalToggle(entry: BackendAuditEntryDTO): string {
  const payload = parseJsonDetails(entry.details);
  const prev = payload?.prev;
  const next = payload?.next;

  if (typeof prev === 'boolean' && typeof next === 'boolean') {
    return next ? 'marcó el evento como interno' : 'quitó la marca de evento interno';
  }

  return 'cambió la visibilidad interna';
}

function generateAuditDescription(entry: BackendAuditEntryDTO): string {
  const actionType = normalizeActionType(entry);

  switch (actionType) {
    case 'STATUS':
      return `cambió el estado de ${entry.fromValue ?? 'N/A'} a ${entry.toValue ?? 'N/A'}`;
    case 'SCHEDULE_CHANGE':
      return 'actualizó agenda/horario';
    case 'FIELD_UPDATE':
      return describeFieldUpdate(entry);
    case 'REPROGRAM':
      return 'reprogramó el evento';
    case 'PRIORITY_CONFLICT':
      return entry.toValue === 'CLOSED'
        ? 'resolvió el conflicto de prioridad'
        : 'registró que el evento fue desplazado por un conflicto de prioridad';
    case 'COMMENT_CREATED':
    case 'COMMENT_UPDATED':
    case 'COMMENT_DELETED':
      return describeComment(entry, actionType);
    case 'INTERNAL_TOGGLED':
      return describeInternalToggle(entry);
    case 'EVENT_DELETED':
      return 'dio de baja el evento';
    default:
      return 'realizó una acción';
  }
}

function getAuditIcon(actionType: AuditActionType): string {
  const iconMap: Record<AuditActionType, string> = {
    STATUS: 'arrow-right-circle',
    SCHEDULE_CHANGE: 'calendar-range',
    FIELD_UPDATE: 'edit',
    REPROGRAM: 'refresh-cw',
    PRIORITY_CONFLICT: 'alert-triangle',
    COMMENT_CREATED: 'message-square-plus',
    COMMENT_UPDATED: 'message-square-more',
    COMMENT_DELETED: 'message-square-x',
    INTERNAL_TOGGLED: 'eye-off',
    EVENT_DELETED: 'trash-2',
  };

  return iconMap[actionType] || 'circle';
}

function getAuditColor(actionType: AuditActionType): string {
  const colorMap: Record<AuditActionType, string> = {
    STATUS: 'bg-blue-100 text-blue-800',
    SCHEDULE_CHANGE: 'bg-sky-100 text-sky-800',
    FIELD_UPDATE: 'bg-amber-100 text-amber-800',
    REPROGRAM: 'bg-orange-100 text-orange-800',
    PRIORITY_CONFLICT: 'bg-fuchsia-100 text-fuchsia-800',
    COMMENT_CREATED: 'bg-emerald-100 text-emerald-800',
    COMMENT_UPDATED: 'bg-emerald-100 text-emerald-800',
    COMMENT_DELETED: 'bg-neutral-100 text-neutral-800',
    INTERNAL_TOGGLED: 'bg-slate-100 text-slate-800',
    EVENT_DELETED: 'bg-red-100 text-red-800',
  };

  return colorMap[actionType] || 'bg-gray-100 text-gray-800';
}

function normalizeDetails(
  entry: BackendAuditEntryDTO,
  actionType: AuditActionType
): string | null {
  switch (actionType) {
    case 'COMMENT_CREATED':
    case 'COMMENT_UPDATED':
    case 'COMMENT_DELETED':
      return normalizeCommentDetails(entry);
    default:
      return entry.details;
  }
}

export function adaptAuditEntryFromBackend(backendEntry: BackendAuditEntryDTO): AuditEntry {
  const actionType = normalizeActionType(backendEntry);

  return {
    id: backendEntry.id,
    actionType,
    field: backendEntry.field ?? null,
    fromValue: backendEntry.fromValue,
    toValue: backendEntry.toValue,
    details: normalizeDetails(backendEntry, actionType),
    reason: backendEntry.reason ?? null,
    note: backendEntry.note ?? null,
    actor: normalizeActor(backendEntry),
    timestamp: normalizeTimestamp(backendEntry),
    description: generateAuditDescription(backendEntry),
    icon: getAuditIcon(actionType),
    color: getAuditColor(actionType),
  };
}

export function adaptAuditEntriesFromBackend(
  backendEntries: BackendAuditEntryDTO[]
): AuditEntry[] {
  return backendEntries.map(adaptAuditEntryFromBackend);
}

export function adaptAuditPageFromBackend(
  backendPage: BackendAuditPage
): PageResponse<AuditEntry> {
  const pageNumber = backendPage.currentPage ?? backendPage.page ?? 0;
  const pageSize = backendPage.pageSize ?? backendPage.size ?? backendPage.entries.length;

  return {
    content: adaptAuditEntriesFromBackend(backendPage.entries),
    page: {
      number: pageNumber,
      size: pageSize,
      totalElements: backendPage.totalElements,
      totalPages: backendPage.totalPages,
    },
    first: pageNumber === 0,
    last: backendPage.totalPages === 0 || pageNumber >= backendPage.totalPages - 1,
    empty: backendPage.entries.length === 0,
  };
}

export function groupAuditEntriesByDate(
  entries: AuditEntry[]
): Map<string, AuditEntry[]> {
  const grouped = new Map<string, AuditEntry[]>();

  entries.forEach((entry) => {
    const dateKey = entry.timestamp.toISOString().split('T')[0];
    const existing = grouped.get(dateKey) || [];
    grouped.set(dateKey, [...existing, entry]);
  });

  return grouped;
}

export function groupAuditEntriesByAction(
  entries: AuditEntry[]
): Map<AuditActionType, AuditEntry[]> {
  const grouped = new Map<AuditActionType, AuditEntry[]>();

  entries.forEach((entry) => {
    const existing = grouped.get(entry.actionType) || [];
    grouped.set(entry.actionType, [...existing, entry]);
  });

  return grouped;
}

export function groupAuditEntriesByActor(
  entries: AuditEntry[]
): Map<number, AuditEntry[]> {
  const grouped = new Map<number, AuditEntry[]>();

  entries.forEach((entry) => {
    if (!entry.actor) {
      return;
    }

    const existing = grouped.get(entry.actor.id) || [];
    grouped.set(entry.actor.id, [...existing, entry]);
  });

  return grouped;
}

export function filterAuditEntriesByAction(
  entries: AuditEntry[],
  actionTypes: AuditActionType[]
): AuditEntry[] {
  return entries.filter((entry) => actionTypes.includes(entry.actionType));
}

export function filterAuditEntriesByDateRange(
  entries: AuditEntry[],
  startDate: Date,
  endDate: Date
): AuditEntry[] {
  return entries.filter((entry) => entry.timestamp >= startDate && entry.timestamp <= endDate);
}

export function filterAuditEntriesByActor(
  entries: AuditEntry[],
  actorId: number
): AuditEntry[] {
  return entries.filter((entry) => entry.actor?.id === actorId);
}

export function getAuditEntryAge(entry: AuditEntry): string {
  const now = new Date();
  const diffMs = now.getTime() - entry.timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;

  return formatAuditEntryDate(entry);
}

export function formatAuditEntryDate(entry: AuditEntry): string {
  return entry.timestamp.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getAuditSummary(entries: AuditEntry[]): {
  total: number;
  byAction: Record<AuditActionType, number>;
  uniqueActors: number;
  dateRange: { start: Date | null; end: Date | null };
} {
  const byAction = Object.values({
    STATUS: 'STATUS',
    SCHEDULE_CHANGE: 'SCHEDULE_CHANGE',
    FIELD_UPDATE: 'FIELD_UPDATE',
    REPROGRAM: 'REPROGRAM',
    PRIORITY_CONFLICT: 'PRIORITY_CONFLICT',
    COMMENT_CREATED: 'COMMENT_CREATED',
    COMMENT_UPDATED: 'COMMENT_UPDATED',
    COMMENT_DELETED: 'COMMENT_DELETED',
    INTERNAL_TOGGLED: 'INTERNAL_TOGGLED',
    EVENT_DELETED: 'EVENT_DELETED',
  }).reduce((acc, value) => {
    acc[value as AuditActionType] = 0;
    return acc;
  }, {} as Record<AuditActionType, number>);

  if (entries.length === 0) {
    return {
      total: 0,
      byAction,
      uniqueActors: 0,
      dateRange: { start: null, end: null },
    };
  }

  const actorIds = new Set<number>();
  const timestamps = entries.map((entry) => entry.timestamp.getTime());

  entries.forEach((entry) => {
    byAction[entry.actionType] = (byAction[entry.actionType] ?? 0) + 1;
    if (entry.actor) {
      actorIds.add(entry.actor.id);
    }
  });

  return {
    total: entries.length,
    byAction,
    uniqueActors: actorIds.size,
    dateRange: {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    },
  };
}

export function getActionTypeLabel(actionType: AuditActionType): string {
  const labelMap: Record<AuditActionType, string> = {
    STATUS: 'Cambio de estado',
    SCHEDULE_CHANGE: 'Cambio de agenda',
    FIELD_UPDATE: 'Actualización de campo',
    REPROGRAM: 'Reprogramación',
    PRIORITY_CONFLICT: 'Conflicto de prioridad',
    COMMENT_CREATED: 'Comentario creado',
    COMMENT_UPDATED: 'Comentario editado',
    COMMENT_DELETED: 'Comentario eliminado',
    INTERNAL_TOGGLED: 'Visibilidad interna',
    EVENT_DELETED: 'Baja del evento',
  };

  return labelMap[actionType] || actionType;
}
