import {
  getRequestLocationLabel,
  getRequestStatusSortOrder,
  matchesRequestSearch,
  type PublicEventRequest,
  type PublicRequestFilters,
} from '@/models/public-request';
import { getLocalDateTimeSortValue } from '@/utils/dates';

export type PublicRequestTableSortField =
  | 'date'
  | 'name'
  | 'location'
  | 'status';

export interface PublicRequestTableManualSort {
  field: PublicRequestTableSortField;
  order: 'asc' | 'desc';
}

interface PublicRequestSortConfig {
  field: string;
  order: 'asc' | 'desc';
}

const DEFAULT_PUBLIC_REQUEST_SORT: PublicRequestSortConfig[] = [
  { field: 'date', order: 'asc' },
  { field: 'scheduleFrom', order: 'asc' },
  { field: 'requestDate', order: 'desc' },
];

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

function compareTimestamp(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftValue = left ? Date.parse(left) : null;
  const rightValue = right ? Date.parse(right) : null;

  return compareNumber(leftValue, rightValue);
}

function getTimeSortValue(timeString: string | null | undefined): number | null {
  if (!timeString) return null;

  const [hours = 0, minutes = 0] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function parsePublicRequestSort(sortString: string): PublicRequestSortConfig[] {
  if (!sortString.trim()) {
    return [...DEFAULT_PUBLIC_REQUEST_SORT];
  }

  return sortString
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [field = 'requestDate', order = 'desc'] = pair.split(',');

      return {
        field: field.trim(),
        order: order.trim().toLowerCase() === 'asc' ? 'asc' : 'desc',
      } as PublicRequestSortConfig;
    });
}

function serializePublicRequestSort(sorts: PublicRequestSortConfig[]): string {
  return sorts.map((sort) => `${sort.field},${sort.order}`).join(';');
}

function dedupeSorts(sorts: PublicRequestSortConfig[]): PublicRequestSortConfig[] {
  const seenFields = new Set<string>();

  return sorts.filter((sort) => {
    if (seenFields.has(sort.field)) {
      return false;
    }

    seenFields.add(sort.field);
    return true;
  });
}

function comparePublicRequestsByField(
  left: PublicEventRequest,
  right: PublicEventRequest,
  field: string
): number {
  switch (field) {
    case 'date':
      return compareNumber(
        getLocalDateTimeSortValue(left.date, left.scheduleFrom),
        getLocalDateTimeSortValue(right.date, right.scheduleFrom)
      );
    case 'scheduleFrom':
      return compareNumber(
        getTimeSortValue(left.scheduleFrom),
        getTimeSortValue(right.scheduleFrom)
      );
    case 'scheduleTo':
      return compareNumber(
        getTimeSortValue(left.scheduleTo),
        getTimeSortValue(right.scheduleTo)
      );
    case 'requestDate':
      return compareTimestamp(left.requestDate, right.requestDate);
    case 'name':
      return compareText(left.name, right.name);
    case 'location':
      return compareText(getRequestLocationLabel(left), getRequestLocationLabel(right));
    case 'status':
      return compareNumber(
        getRequestStatusSortOrder(left.status),
        getRequestStatusSortOrder(right.status)
      );
    case 'contactName':
      return compareText(left.contactName, right.contactName);
    default:
      return 0;
  }
}

export function getEffectivePublicRequestDateRange(filters: PublicRequestFilters) {
  return {
    startDate: filters.startDate ?? filters.dateFrom,
    endDate: filters.endDate ?? filters.dateTo,
  };
}

export function matchesPublicRequestFilters(
  request: PublicEventRequest,
  filters: PublicRequestFilters
): boolean {
  const search = filters.search?.trim();
  const { startDate, endDate } = getEffectivePublicRequestDateRange(filters);

  if (search && !matchesRequestSearch(request, search)) {
    return false;
  }

  if (filters.status?.length && !filters.status.includes(request.status)) {
    return false;
  }

  if (startDate && request.date < startDate) {
    return false;
  }

  if (endDate && request.date > endDate) {
    return false;
  }

  return true;
}

export function filterPublicRequests(
  requests: PublicEventRequest[],
  filters: PublicRequestFilters
): PublicEventRequest[] {
  return requests.filter((request) => matchesPublicRequestFilters(request, filters));
}

export function sortPublicRequests(
  requests: PublicEventRequest[],
  sortString: string
): PublicEventRequest[] {
  const sorts = parsePublicRequestSort(sortString);

  return [...requests].sort((leftRequest, rightRequest) => {
    for (const sort of sorts) {
      const comparison = comparePublicRequestsByField(
        leftRequest,
        rightRequest,
        sort.field
      );

      if (comparison !== 0) {
        return sort.order === 'desc' ? -comparison : comparison;
      }
    }

    return 0;
  });
}

export function getDefaultPublicRequestSort(): string {
  return serializePublicRequestSort(DEFAULT_PUBLIC_REQUEST_SORT);
}

export function isDefaultPublicRequestSort(sortString: string): boolean {
  const currentSorts = parsePublicRequestSort(sortString);

  if (currentSorts.length !== DEFAULT_PUBLIC_REQUEST_SORT.length) {
    return false;
  }

  return DEFAULT_PUBLIC_REQUEST_SORT.every((defaultSort, index) => {
    const currentSort = currentSorts[index];

    return (
      currentSort?.field === defaultSort.field &&
      currentSort?.order === defaultSort.order
    );
  });
}

export function getNextPublicRequestTableSort(
  currentSort: PublicRequestTableManualSort | null,
  field: PublicRequestTableSortField
): PublicRequestTableManualSort | null {
  if (!currentSort || currentSort.field !== field) {
    return { field, order: 'asc' };
  }

  if (currentSort.order === 'asc') {
    return { field, order: 'desc' };
  }

  return null;
}

export function buildPublicRequestSort(
  manualSort: PublicRequestTableManualSort | null
): string {
  if (!manualSort) {
    return getDefaultPublicRequestSort();
  }

  const primarySorts: PublicRequestSortConfig[] =
    manualSort.field === 'date'
      ? [
          { field: 'date', order: manualSort.order },
          { field: 'scheduleFrom', order: manualSort.order },
        ]
      : [{ field: manualSort.field, order: manualSort.order }];

  return serializePublicRequestSort(
    dedupeSorts([...primarySorts, ...DEFAULT_PUBLIC_REQUEST_SORT])
  );
}

export function getPublicRequestTableManualSort(
  sortString: string
): PublicRequestTableManualSort | null {
  if (!sortString || isDefaultPublicRequestSort(sortString)) {
    return null;
  }

  const [primarySort] = parsePublicRequestSort(sortString);
  const sortableFields = new Set<PublicRequestTableSortField>([
    'date',
    'name',
    'location',
    'status',
  ]);

  if (!primarySort || !sortableFields.has(primarySort.field as PublicRequestTableSortField)) {
    return null;
  }

  return {
    field: primarySort.field as PublicRequestTableSortField,
    order: primarySort.order,
  };
}
