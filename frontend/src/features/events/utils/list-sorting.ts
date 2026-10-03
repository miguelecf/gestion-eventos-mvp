import type { Event, SortConfig } from '@/models/event';
import { getLocalDateTimeSortValue } from '@/utils/dates';
import { getStatusSortOrder } from '@/utils/event-status';

export type EventTableSortField =
  | 'date'
  | 'name'
  | 'location'
  | 'department'
  | 'status'
  | 'priority'
  | 'technique'
  | 'type';

export interface EventTableManualSort {
  field: EventTableSortField;
  order: 'asc' | 'desc';
}

export const DEFAULT_EVENT_SORT: SortConfig[] = [
  { field: 'date', order: 'asc' },
  { field: 'scheduleFrom', order: 'asc' },
  { field: 'priority', order: 'desc' },
];

const PRIORITY_SORT_ORDER: Record<Event['priority'], number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function compareText(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftValue = normalizeText(left);
  const rightValue = normalizeText(right);

  if (!leftValue && !rightValue) return 0;
  if (!leftValue) return 1;
  if (!rightValue) return -1;

  return leftValue.localeCompare(rightValue, 'es-AR', {
    numeric: true,
    sensitivity: 'base',
  });
}

function compareNumber(
  left: number | null | undefined,
  right: number | null | undefined
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  return left - right;
}

function getTimeSortValue(timeString: string | null | undefined): number | null {
  if (!timeString) return null;

  const [hours = 0, minutes = 0] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function getEventLocationName(event: Event): string | null {
  return normalizeText(event.space?.name ?? event.freeLocation);
}

function getEventDepartmentName(event: Event): string | null {
  return normalizeText(event.department?.name);
}

function getEventTechniqueOrder(event: Event): number {
  if (!event.requiresTech) return 0;
  if (event.techSupportMode === 'SETUP_ONLY') return 1;
  if (event.techSupportMode === 'ATTENDED') return 3;
  return 2;
}

function getEventTypeOrder(event: Event): number {
  return event.internal ? 0 : 1;
}

function compareTimestamp(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftValue = left ? Date.parse(left) : null;
  const rightValue = right ? Date.parse(right) : null;

  return compareNumber(leftValue, rightValue);
}

type EventSortComparator = (left: Event, right: Event) => number;

const EVENT_SORT_COMPARATORS: Record<string, EventSortComparator> = {
  date: (left, right) =>
    compareNumber(
      getLocalDateTimeSortValue(left.date, left.scheduleFrom),
      getLocalDateTimeSortValue(right.date, right.scheduleFrom)
    ),
  scheduleFrom: (left, right) =>
    compareNumber(
      getTimeSortValue(left.scheduleFrom),
      getTimeSortValue(right.scheduleFrom)
    ),
  scheduleTo: (left, right) =>
    compareNumber(getTimeSortValue(left.scheduleTo), getTimeSortValue(right.scheduleTo)),
  priority: (left, right) =>
    compareNumber(
      PRIORITY_SORT_ORDER[left.priority],
      PRIORITY_SORT_ORDER[right.priority]
    ),
  name: (left, right) => compareText(left.name, right.name),
  location: (left, right) =>
    compareText(getEventLocationName(left), getEventLocationName(right)),
  department: (left, right) =>
    compareText(getEventDepartmentName(left), getEventDepartmentName(right)),
  status: (left, right) =>
    compareNumber(
      getStatusSortOrder(left.status),
      getStatusSortOrder(right.status)
    ),
  technique: (left, right) =>
    compareNumber(getEventTechniqueOrder(left), getEventTechniqueOrder(right)),
  type: (left, right) =>
    compareNumber(getEventTypeOrder(left), getEventTypeOrder(right)),
  createdOn: (left, right) =>
    compareTimestamp(left.createdOn ?? left.createdAt, right.createdOn ?? right.createdAt),
  createdAt: (left, right) => compareTimestamp(left.createdAt, right.createdAt),
};

function compareEventsByField(left: Event, right: Event, field: string): number {
  const comparator = EVENT_SORT_COMPARATORS[field];
  if (comparator) {
    return comparator(left, right);
  }

  const leftValue = (left as unknown as Record<string, unknown>)[field];
  const rightValue = (right as unknown as Record<string, unknown>)[field];

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return compareNumber(leftValue, rightValue);
  }

  if (typeof leftValue === 'boolean' && typeof rightValue === 'boolean') {
    return compareNumber(Number(leftValue), Number(rightValue));
  }

  return compareText(
    typeof leftValue === 'string' ? leftValue : null,
    typeof rightValue === 'string' ? rightValue : null
  );
}

function dedupeSorts(sorts: SortConfig[]): SortConfig[] {
  const seenFields = new Set<string>();

  return sorts.filter((sort) => {
    if (seenFields.has(sort.field)) {
      return false;
    }

    seenFields.add(sort.field);
    return true;
  });
}

export function getDefaultEventSort(): SortConfig[] {
  return DEFAULT_EVENT_SORT.map((sort) => ({ ...sort }));
}

export function isDefaultEventSort(sorts: SortConfig[]): boolean {
  if (sorts.length !== DEFAULT_EVENT_SORT.length) {
    return false;
  }

  return DEFAULT_EVENT_SORT.every((defaultSort, index) => {
    const currentSort = sorts[index];
    return (
      currentSort?.field === defaultSort.field &&
      currentSort?.order === defaultSort.order
    );
  });
}

export function getNextEventTableSort(
  currentSort: EventTableManualSort | null,
  field: EventTableSortField
): EventTableManualSort | null {
  if (!currentSort || currentSort.field !== field) {
    return { field, order: 'asc' };
  }

  if (currentSort.order === 'asc') {
    return { field, order: 'desc' };
  }

  return null;
}

export function buildEventSortConfig(
  manualSort: EventTableManualSort | null
): SortConfig[] {
  if (!manualSort) {
    return getDefaultEventSort();
  }

  const primarySorts: SortConfig[] =
    manualSort.field === 'date'
      ? [
          { field: 'date', order: manualSort.order },
          { field: 'scheduleFrom', order: manualSort.order },
        ]
      : [{ field: manualSort.field, order: manualSort.order }];

  return dedupeSorts([...primarySorts, ...getDefaultEventSort()]);
}

export function getEventTableManualSort(
  sorts: SortConfig[]
): EventTableManualSort | null {
  if (!sorts.length || isDefaultEventSort(sorts)) {
    return null;
  }

  const [primarySort] = sorts;

  if (!primarySort) {
    return null;
  }

  const sortableFields = new Set<EventTableSortField>([
    'date',
    'name',
    'location',
    'department',
    'status',
    'priority',
    'technique',
    'type',
  ]);

  if (!sortableFields.has(primarySort.field as EventTableSortField)) {
    return null;
  }

  return {
    field: primarySort.field as EventTableSortField,
    order: primarySort.order,
  };
}

export function sortEvents(events: Event[], sorts: SortConfig[]): Event[] {
  if (!sorts.length) {
    return [...events];
  }

  return [...events].sort((leftEvent, rightEvent) => {
    for (const sort of sorts) {
      const comparison = compareEventsByField(leftEvent, rightEvent, sort.field);

      if (comparison !== 0) {
        return sort.order === 'desc' ? -comparison : comparison;
      }
    }

    return 0;
  });
}
