import type { Priority } from "@/services/api/types/backend.types";
import type { Department } from "./department";
import type { Space } from "./space";

export type PublicRequestStatus =
  | "RECIBIDO"
  | "EN_REVISION"
  | "RECHAZADO"
  | "CONVERTIDO";

export const PUBLIC_REQUEST_STATUSES: readonly PublicRequestStatus[] = [
  "RECIBIDO",
  "EN_REVISION",
  "RECHAZADO",
  "CONVERTIDO",
] as const;

export type RequestAudienceType =
  | "ESTUDIANTES"
  | "COMUNIDAD"
  | "AUTORIDADES"
  | "DOCENTES"
  | "TERCERA_EDAD";

export interface PublicEventRequest {
  id: number;
  trackingUuid: string;
  date: string;
  technicalSchedule: string | null;
  scheduleFrom: string;
  scheduleTo: string;
  status: PublicRequestStatus;
  name: string;
  space: Space | null;
  freeLocation: string | null;
  requestingDepartment: Department | null;
  requirements: string | null;
  coverage: string | null;
  observations: string | null;
  priority: Priority;
  audienceType: RequestAudienceType;
  bufferBeforeMin: number;
  bufferAfterMin: number;
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

export interface PublicRequestFilters {
  search?: string;
  status?: PublicRequestStatus[];
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
}

export interface PublicRequestsQueryParams {
  page?: number;
  size?: number;
  sort?: string;
  search?: string;
  status?: PublicRequestStatus[];
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export function getRequestStatusBadgeVariant(
  status: PublicRequestStatus
): "default" | "success" | "outline" {
  switch (status) {
    case "RECIBIDO":
      return "outline";
    case "EN_REVISION":
      return "default";
    case "CONVERTIDO":
      return "success";
    case "RECHAZADO":
      return "outline";
    default:
      return "outline";
  }
}

export function getRequestStatusLabel(status: PublicRequestStatus): string {
  switch (status) {
    case "RECIBIDO":
      return "Recibido";
    case "EN_REVISION":
      return "En revisión";
    case "RECHAZADO":
      return "Rechazado";
    case "CONVERTIDO":
      return "Convertido";
    default:
      return status;
  }
}

export function getRequestStatusColor(status: PublicRequestStatus): string {
  switch (status) {
    case "RECIBIDO":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "EN_REVISION":
      return "border-blue-300 bg-blue-100 text-blue-700";
    case "RECHAZADO":
      return "border-red-300 bg-red-100 text-red-700";
    case "CONVERTIDO":
      return "border-emerald-300 bg-emerald-100 text-emerald-700";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
}

export function getRequestStatusDescription(
  status: PublicRequestStatus
): string {
  switch (status) {
    case "RECIBIDO":
      return "Solicitud recibida, pendiente de revisión administrativa.";
    case "EN_REVISION":
      return "Solicitud en evaluación para decidir rechazo o conversión.";
    case "RECHAZADO":
      return "Solicitud cerrada. Ya no puede convertirse en evento.";
    case "CONVERTIDO":
      return "Solicitud convertida. La gestión continúa en el módulo de eventos.";
    default:
      return "";
  }
}

export function getRequestStatusSortOrder(status: PublicRequestStatus): number {
  switch (status) {
    case "RECIBIDO":
      return 0;
    case "EN_REVISION":
      return 1;
    case "RECHAZADO":
      return 2;
    case "CONVERTIDO":
      return 3;
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}

export function canMoveRequestToReview(status: PublicRequestStatus): boolean {
  return status === "RECIBIDO";
}

export function canRejectRequest(status: PublicRequestStatus): boolean {
  return status === "RECIBIDO" || status === "EN_REVISION";
}

export function canConvertRequestToEvent(status: PublicRequestStatus): boolean {
  return status === "EN_REVISION";
}

export function getAudienceTypeLabel(type: RequestAudienceType): string {
  switch (type) {
    case "ESTUDIANTES":
      return "Estudiantes";
    case "COMUNIDAD":
      return "Comunidad";
    case "TERCERA_EDAD":
      return "Tercera edad";
    case "DOCENTES":
      return "Docentes";
    case "AUTORIDADES":
      return "Autoridades";
    default:
      return type;
  }
}

export function getRequestLocationLabel(request: PublicEventRequest): string {
  return request.space?.name || request.freeLocation || "Sin ubicación definida";
}

export function getRequestLocationHint(request: PublicEventRequest): string | null {
  if (request.space) {
    return "Espacio interno";
  }
  if (request.freeLocation) {
    return "Otra ubicación";
  }
  return null;
}

export function matchesRequestSearch(
  request: PublicEventRequest,
  search: string
): boolean {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const haystack = [
    request.name,
    request.trackingUuid,
    request.contactName,
    request.contactEmail,
    request.contactPhone,
    request.requestingDepartment?.name,
    request.space?.name,
    request.freeLocation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}
