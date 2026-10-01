import { httpClient } from "./client";
import { ENDPOINTS } from "./client/config";
import type {
  AvailabilityCheckRequest,
  AvailabilityCheckResponse,
  EventRequestCreatedResponse,
  EventRequestStatusResponse,
  EventStatus,
  PublicEventRequestPayload,
  SpaceOccupancyResponse,
} from "./types/backend.types";
import type { PageResponse, SpringPageResponse } from "./types/pagination.types";
import {
  type PublicEventRequest,
  type PublicRequestStatus,
  type PublicRequestFilters,
  type PublicRequestsQueryParams,
} from "@/models/public-request";
import type { Department } from "@/models/department";
import type { Space } from "@/models/space";
import {
  filterPublicRequests,
  getDefaultPublicRequestSort,
  sortPublicRequests,
} from '@/features/publicRequests/utils/list-sorting';

export interface PublicSpacesFilters {
  publishableOnly?: boolean;
}

export interface PublicSpaceOption {
  id: number;
  value: number;
  name: string;
  label: string;
  capacity: number | null;
  location: string | null;
  active: boolean;
  publishable: boolean;
}

type PublicSpaceScalar = number | string | null | undefined;

type RawPublicSpaceListItem = {
  id?: PublicSpaceScalar;
  value?: PublicSpaceScalar;
  name?: string | null;
  label?: string | null;
  capacity?: PublicSpaceScalar;
  location?: string | null;
  active?: boolean | null;
  publishable?: boolean | null;
};

type PublicSpacesResponse =
  | RawPublicSpaceListItem[]
  | {
      content?: RawPublicSpaceListItem[];
    };

export interface ChangeAdminRequestStatusInput {
  newStatus: Extract<PublicRequestStatus, "EN_REVISION" | "RECHAZADO">;
  reason?: string;
}

export interface RequestConversionResult {
  eventId: number;
  eventName: string;
  eventStatus: EventStatus;
}

interface BackendEventRequestResponseDto {
  id: number;
  trackingUuid: string;
  date: string;
  technicalSchedule: string | null;
  scheduleFrom: string;
  scheduleTo: string;
  status: PublicRequestStatus;
  name: string;
  space: {
    id: number;
    name: string;
    capacity: number | null;
    colorHex: string | null;
  } | null;
  freeLocation: string | null;
  requestingDepartment: {
    id: number;
    name: string;
    colorHex: string | null;
  } | null;
  requirements: string | null;
  coverage: string | null;
  observations: string | null;
  priority: PublicEventRequest["priority"];
  audienceType: PublicEventRequest["audienceType"];
  bufferBeforeMin: number | null;
  bufferAfterMin: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  requestDate: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  convertedAt: string | null;
  convertedBy: string | null;
  convertedEventId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface BackendConvertedEventResponseDto {
  id: number;
  status: EventStatus;
  name: string;
}

function adaptSpace(space: BackendEventRequestResponseDto["space"]): Space | null {
  if (!space) {
    return null;
  }

  return {
    id: space.id,
    name: space.name,
    capacity: space.capacity ?? 0,
    colorHex: space.colorHex || "#6B7280",
    defaultBufferBeforeMin: 0,
    defaultBufferAfterMin: 0,
    active: true,
  };
}

function adaptDepartment(
  department: BackendEventRequestResponseDto["requestingDepartment"]
): Department | null {
  if (!department) {
    return null;
  }

  return {
    id: department.id,
    name: department.name,
    colorHex: department.colorHex || "#6B7280",
    active: true,
  };
}

function adaptRequestFromBackend(
  dto: BackendEventRequestResponseDto
): PublicEventRequest {
  return {
    id: dto.id,
    trackingUuid: dto.trackingUuid,
    date: dto.date,
    technicalSchedule: dto.technicalSchedule,
    scheduleFrom: dto.scheduleFrom,
    scheduleTo: dto.scheduleTo,
    status: dto.status,
    name: dto.name,
    space: adaptSpace(dto.space),
    freeLocation: dto.freeLocation,
    requestingDepartment: adaptDepartment(dto.requestingDepartment),
    requirements: dto.requirements,
    coverage: dto.coverage,
    observations: dto.observations,
    priority: dto.priority,
    audienceType: dto.audienceType,
    bufferBeforeMin: dto.bufferBeforeMin ?? 0,
    bufferAfterMin: dto.bufferAfterMin ?? 0,
    contactName: dto.contactName,
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
    requestDate: dto.requestDate,
    reviewedAt: dto.reviewedAt,
    reviewedBy: dto.reviewedBy,
    convertedAt: dto.convertedAt,
    convertedBy: dto.convertedBy,
    convertedEventId: dto.convertedEventId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function adaptLocalPage(
  items: PublicEventRequest[],
  page: number,
  size: number
): PageResponse<PublicEventRequest> {
  const totalElements = items.length;
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / size);
  const startIndex = page * size;
  const content = items.slice(startIndex, startIndex + size);

  return {
    content,
    page: {
      number: page,
      size,
      totalElements,
      totalPages,
    },
    first: page === 0,
    last: totalPages === 0 || page >= totalPages - 1,
    empty: totalElements === 0,
  };
}

function normalizeRequestCollection(
  data: BackendEventRequestResponseDto[] | SpringPageResponse<BackendEventRequestResponseDto>
): BackendEventRequestResponseDto[] {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data.content) ? data.content : [];
}

function normalizeInteger(value: PublicSpaceScalar): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeCapacity(value: PublicSpaceScalar): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

function normalizePublicSpacesResponse(data: PublicSpacesResponse): RawPublicSpaceListItem[] {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data.content) ? data.content : [];
}

function adaptPublicSpaceOption(space: RawPublicSpaceListItem): PublicSpaceOption | null {
  const id = normalizeInteger(space.id ?? space.value);
  if (id === null) {
    return null;
  }

  const name = normalizeText(space.name, space.label) ?? `Espacio ${id}`;
  const capacity = normalizeCapacity(space.capacity);
  const label =
    normalizeText(space.label) ?? (capacity === null ? name : `${name} - Capacidad: ${capacity}`);

  return {
    id,
    value: id,
    name,
    label,
    capacity,
    location: normalizeText(space.location),
    active: space.active !== false,
    publishable: space.publishable !== false,
  };
}

export async function listAdminRequests(
  params: PublicRequestsQueryParams = {}
): Promise<PageResponse<PublicEventRequest>> {
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const sort = params.sort ?? getDefaultPublicRequestSort();
  const filters: PublicRequestFilters = {
    search: params.search?.trim(),
    status: params.status,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    startDate: params.startDate,
    endDate: params.endDate,
  };

  // Bandeja administrativa (autenticada): todas las solicitudes en cualquier estado.
  // El filtrado/orden/paginado se resuelve localmente sobre ese conjunto.
  const backendRequests = await httpClient.get<
    BackendEventRequestResponseDto[] | SpringPageResponse<BackendEventRequestResponseDto>
  >(
    ENDPOINTS.ADMIN_EVENT_REQUESTS
  );

  const normalizedRequests = normalizeRequestCollection(backendRequests).map(adaptRequestFromBackend);
  const filteredRequests = filterPublicRequests(normalizedRequests, filters);
  const sortedRequests = sortPublicRequests(filteredRequests, sort);

  return adaptLocalPage(sortedRequests, page, size);
}

export async function getAdminRequestById(id: number): Promise<PublicEventRequest> {
  const request = await httpClient.get<BackendEventRequestResponseDto>(
    ENDPOINTS.ADMIN_EVENT_REQUEST_BY_ID(id)
  );

  return adaptRequestFromBackend(request);
}

export async function changeAdminRequestStatus(
  id: number,
  payload: ChangeAdminRequestStatusInput
): Promise<PublicEventRequest> {
  const request = await httpClient.patch<BackendEventRequestResponseDto>(
    ENDPOINTS.ADMIN_EVENT_REQUEST_STATUS(id),
    payload
  );

  return adaptRequestFromBackend(request);
}

/** Soporte técnico que define el área al convertir (el formulario público no lo captura). */
export interface RequestConversionOptions {
  requiresTech: boolean;
  techSupportMode?: 'SETUP_ONLY' | 'ATTENDED';
}

/** Entrada del historial de una solicitud (GET /admin/event-requests/{id}/history). */
export interface RequestHistoryEntry {
  id: number;
  at: string;
  type: string;
  fromValue: string | null;
  toValue: string | null;
  reason: string | null;
  /** null cuando la acción la originó el solicitante (alta pública). */
  actor: { id: number; username: string; name: string; lastName: string } | null;
}

export async function getAdminRequestHistory(id: number): Promise<RequestHistoryEntry[]> {
  return httpClient.get<RequestHistoryEntry[]>(`${ENDPOINTS.ADMIN_EVENT_REQUEST_BY_ID(id)}/history`);
}

export async function convertAdminRequestToEvent(
  id: number,
  options: RequestConversionOptions = { requiresTech: false }
): Promise<RequestConversionResult> {
  const event = await httpClient.post<BackendConvertedEventResponseDto>(
    ENDPOINTS.ADMIN_EVENT_REQUEST_CONVERT(id),
    options
  );

  return {
    eventId: event.id,
    eventName: event.name,
    eventStatus: event.status,
  };
}

export const getPublicRequests = listAdminRequests;
export const getPublicRequestById = getAdminRequestById;

export async function createPublicEventRequest(
  payload: PublicEventRequestPayload
): Promise<EventRequestCreatedResponse> {
  return await httpClient.post<EventRequestCreatedResponse>(
    ENDPOINTS.PUBLIC_EVENT_REQUESTS,
    payload
  );
}

export async function trackPublicEventRequest(
  trackingUuid: string
): Promise<EventRequestStatusResponse> {
  return await httpClient.get<EventRequestStatusResponse>(
    ENDPOINTS.PUBLIC_TRACK(trackingUuid)
  );
}

export async function checkPublicAvailability(
  checkRequest: AvailabilityCheckRequest
): Promise<AvailabilityCheckResponse> {
  return await httpClient.post<AvailabilityCheckResponse>(
    ENDPOINTS.AVAILABILITY_PUBLIC_CHECK,
    checkRequest
  );
}

export async function getPublicSpaces(
  filters?: PublicSpacesFilters
): Promise<PublicSpaceOption[]> {
  const params = new URLSearchParams();

  if (filters?.publishableOnly !== false) {
    params.append("publishableOnly", "true");
  }

  const response = await httpClient.get<PublicSpacesResponse>(
    `${ENDPOINTS.CATALOG_SPACES_PUBLIC}${params.toString() ? `?${params.toString()}` : ""}`
  );

  return normalizePublicSpacesResponse(response)
    .map(adaptPublicSpaceOption)
    .filter((space): space is PublicSpaceOption => space !== null);
}

export async function getSpaceMonthlyOccupancy(
  spaceId: number,
  year: number,
  month: number
): Promise<SpaceOccupancyResponse> {
  return await httpClient.get<SpaceOccupancyResponse>(
    ENDPOINTS.PUBLIC_SPACE_OCCUPANCY(spaceId),
    {
      params: { year, month },
    }
  );
}

export const publicRequestsApi = {
  listAdminRequests,
  getAdminRequestById,
  changeAdminRequestStatus,
  convertAdminRequestToEvent,
  getAdminRequestHistory,
  getPublicRequests,
  getPublicRequestById,
  createPublicEventRequest,
  trackPublicEventRequest,
  checkPublicAvailability,
  getPublicSpaces,
  getSpaceMonthlyOccupancy,
};

export default publicRequestsApi;
