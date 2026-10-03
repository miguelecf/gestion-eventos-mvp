/**
 * ===================================================================
 * TIPOS BACKEND - DTOs EXACTOS DEL BACKEND (Spring Boot)
 * ===================================================================
 * Estos tipos representan la estructura RAW que devuelve el backend.
 * NO modificar - deben coincidir con los DTOs de Java.
 * ===================================================================
 */

// ==================== ENUMS DEL BACKEND ====================
// Nota: Usamos const objects con 'as const' en lugar de enums
// por la configuración de TypeScript (erasableSyntaxOnly)

/**
 * Estado del Evento
 */
export const EventStatus = {
  EN_REVISION: 'EN_REVISION',
  RESERVADO: 'RESERVADO',
  APROBADO: 'APROBADO',
  RECHAZADO: 'RECHAZADO'
} as const;
export type EventStatus = typeof EventStatus[keyof typeof EventStatus];

/**
 * Prioridad del Evento
 */
export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
} as const;
export type Priority = typeof Priority[keyof typeof Priority];

/**
 * Modo de Soporte Técnico
 */
export const TechSupportMode = {
  SETUP_ONLY: 'SETUP_ONLY',
  ATTENDED: 'ATTENDED'
} as const;
export type TechSupportMode = typeof TechSupportMode[keyof typeof TechSupportMode];

/**
 * Tipo de Audiencia
 */
export const AudienceType = {
  ESTUDIANTES: 'ESTUDIANTES',
  DOCENTES: 'DOCENTES',
  AUTORIDADES: 'AUTORIDADES',
  COMUNIDAD: 'COMUNIDAD',
  TERCERA_EDAD: 'TERCERA_EDAD'
} as const;
export type AudienceType = typeof AudienceType[keyof typeof AudienceType];

/**
 * Roles de Usuario
 */
export const UserRole = {
  USUARIO: 'USUARIO',
  ADMIN_CEREMONIAL: 'ADMIN_CEREMONIAL',
  ADMIN_TECNICA: 'ADMIN_TECNICA',
  ADMIN_FULL: 'ADMIN_FULL'
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

/**
 * Visibilidad de Comentarios
 */
export const CommentVisibility = {
  INTERNAL: 'INTERNAL',
  PUBLIC: 'PUBLIC'
} as const;
export type CommentVisibility = typeof CommentVisibility[keyof typeof CommentVisibility];

/**
 * Tipos de Acciones de Auditoría
 */
export const AuditActionType = {
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
} as const;
export type AuditActionType = typeof AuditActionType[keyof typeof AuditActionType];

export const EventOriginType = {
  MANUAL: 'MANUAL',
  PUBLIC_REQUEST: 'PUBLIC_REQUEST',
} as const;
export type EventOriginType = typeof EventOriginType[keyof typeof EventOriginType];

/**
 * Estado de Solicitudes Públicas
 */
export const PublicRequestStatus = {
  RECEIVED: 'RECEIVED',
  CONVERTED: 'CONVERTED'
} as const;
export type PublicRequestStatus = typeof PublicRequestStatus[keyof typeof PublicRequestStatus];

/**
 * Estado de Conflictos de Prioridad
 */
export const PriorityConflictStatus = {
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED'
} as const;
export type PriorityConflictStatus = typeof PriorityConflictStatus[keyof typeof PriorityConflictStatus];

/**
 * Decisión sobre Conflictos
 */
export const ConflictDecision = {
  KEEP_NEW: 'KEEP_NEW',
  KEEP_DISPLACED: 'KEEP_DISPLACED'
} as const;
export type ConflictDecision = typeof ConflictDecision[keyof typeof ConflictDecision];

// ==================== DTOs DEL BACKEND ====================

/**
 * DTO de Evento del Backend (respuesta anidada)
 * Endpoint: GET /api/events, GET /api/events/{id}
 */
export interface BackendEventDTO {
  id: number;
  date: string;               // yyyy-MM-dd
  technicalSchedule: string | null; // HH:mm
  scheduleFrom: string;       // HH:mm
  scheduleTo: string;         // HH:mm
  status: EventStatus;
  name: string;
  requestingArea: string | null;
  space: {
    id: number;
    name: string;
    capacity: number;
    colorHex: string;
  } | null;
  freeLocation: string | null;
  department: {
    id: number;
    name: string;
    colorHex: string;
  } | null;
  requirements: string | null;
  coverage: string | null;
  observations: string | null;
  priority: Priority;
  audienceType: AudienceType;
  internal: boolean;
  ceremonialOk: boolean;
  technicalOk: boolean;
  requiresTech: boolean;
  techSupportMode: TechSupportMode | null;
  requiresRebooking: boolean;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
  createdBy: {
    id: number;
    username: string;
    name: string;
    lastName: string;
    email: string;
  } | null;
  lastModifiedBy: {
    id: number;
    username: string;
    name: string;
    lastName: string;
    email: string;
  } | null;
  originType?: EventOriginType | null;
  originRequestId?: number | null;
}

export interface BackendPriorityConflictSummary {
  conflictCode: string;
  displacedEventId: number;
  spaceId: number;
  fromTime: string;
  toTime: string;
  requiresRebooking: boolean;
}

export interface BackendEventCreateResult {
  eventId: number;
  priority: Priority;
  status: EventStatus;
  priorityConflicts: BackendPriorityConflictSummary[];
}

export interface BackendEventUpdateResult {
  eventId: number;
  priority: Priority;
  status: EventStatus;
  priorityConflicts: BackendPriorityConflictSummary[];
}

/**
 * DTO para crear Evento
 * Endpoint: POST /api/events
 */
export interface BackendCreateEventDTO {
  date: string;                      // yyyy-MM-dd
  technicalSchedule?: string | null; // HH:mm
  scheduleFrom: string;              // HH:mm
  scheduleTo: string;                // HH:mm
  spaceId: number | null;
  freeLocation: string | null;
  departmentId: number | null;
  name: string;
  requestingArea?: string | null;
  requirements?: string | null;
  coverage?: string | null;
  observations?: string | null;
  priority: Priority;
  audienceType?: AudienceType | null;
  internal: boolean;
  requiresTech: boolean;
  techSupportMode?: TechSupportMode | null;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

/**
 * DTO para actualizar Evento
 * Endpoint: PATCH /api/events/{id}
 */
export type BackendUpdateEventDTO = Partial<Omit<BackendCreateEventDTO, 'contactName' | 'contactEmail' | 'contactPhone'>> & {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

/**
 * DTO de respuesta GET /api/events/{id}/status
 * IMPORTANTE: El backend devuelve 'current' y 'allowed' (no 'currentStatus' y 'allowedTransitions')
 */
export interface BackendEventStatusResponse {
  eventId: number;
  current: string;              // ✅ Campo real del backend
  allowed: string[];            // ✅ Campo real del backend
  currentStatus?: string;       // Deprecated: mantener por compatibilidad
  allowedTransitions?: string[]; // Deprecated: mantener por compatibilidad
}

/**
 * DTO de request POST /api/events/{id}/status
 */
export interface BackendChangeStatusRequest {
  to: string;
  reason?: string | null;
  note?: string | null;
}

/**
 * DTO de respuesta de cambio de estado
 * Endpoint: POST /api/events/{id}/status
 * ⚠️ IMPORTANTE: Backend envía 'status' como campo principal, no 'newStatus'
 */
export interface BackendStatusChangeResponse {
  eventId: number;
  status: EventStatus;           // ✅ Campo REAL del backend
  newStatus?: EventStatus;       // ⚠️ Deprecated: para compatibilidad
  approvalPending?: boolean;
  missing?: string[];            // ✅ Campo REAL del backend
  missingApprovals?: string[];   // ⚠️ Deprecated: para compatibilidad
}

/**
 * DTO de Comentario del Backend
 * Endpoint: GET /api/events/{eventId}/comments
 */
export interface BackendCommentDTO {
  id: number;
  body: string;
  visibility: CommentVisibility;
  author: {
    id: number;
    name: string;
  } | null;
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
  editedBy?: {
    id: number;
    name: string;
  } | null;
  authorId?: number;
  authorUsername?: string;
  authorName?: string;
  authorLastName?: string;
}

/**
 * Respuesta paginada de comentarios
 * Endpoint: GET /api/events/{eventId}/comments
 */
export interface BackendCommentsPage {
  eventId: number;
  items?: BackendCommentDTO[];
  comments?: BackendCommentDTO[];
  page: number | {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
  size?: number;
  total?: number;
}

/**
 * DTO para crear Comentario
 * Endpoint: POST /api/events/{eventId}/comments
 */
export interface BackendCreateCommentDTO {
  body: string;
}

/**
 * DTO para actualizar Comentario
 * Endpoint: PATCH /api/events/{eventId}/comments/{commentId}
 */
export interface BackendUpdateCommentDTO {
  body: string;
}

/**
 * DTO de entrada de Auditoría del Backend
 * Endpoint: GET /api/audit/{eventId}
 */
export interface BackendAuditEntryDTO {
  id: number;
  type?: AuditActionType;
  actionType?: AuditActionType;
  field?: string | null;
  fromValue: string | null;
  toValue: string | null;
  details: string | null;
  reason?: string | null;
  note?: string | null;
  at?: string;               // ISO 8601
  timestamp?: string;        // ISO 8601 legacy
  actor?: {
    id: number;
    username: string;
    name: string;
    lastName: string;
    email: string;
  } | null;
  actorId?: number;
  actorUsername?: string;
  actorName?: string;
  actorLastName?: string;
}

/**
 * Respuesta paginada de auditoría
 * Endpoint: GET /api/audit/{eventId}
 */
export interface BackendAuditPage {
  eventId: number;
  totalElements: number;
  totalPages: number;
  currentPage?: number;
  pageSize?: number;
  page?: number;
  size?: number;
  entries: BackendAuditEntryDTO[];
}

/**
 * DTO de Espacio del Backend
 * Endpoint: GET /api/catalogs/spaces
 */
export interface BackendSpaceDTO {
  id: number;
  name: string;
  capacity: number;
  location: string;
  description: string;
  colorHex: string;
  defaultBufferBeforeMin: number;
  defaultBufferAfterMin: number;
  active: boolean;
}

/**
 * DTO de Departamento del Backend
 * Endpoint: GET /api/catalogs/departments
 */
export interface BackendDepartmentDTO {
  id: number;
  name: string;
  colorHex: string;
  active: boolean;
}

/**
 * Respuesta de disponibilidad de espacio
 * Endpoint: POST /api/availability/check, POST /public/availability/check
 */
export interface BackendSpaceAvailabilityResponse {
  available: boolean;
  conflicts: Array<{
    eventId: number;
    eventName: string;
    from: string;              // HH:mm
    to: string;                // HH:mm
    status?: EventStatus;
    priority?: Priority;
    bufferBefore?: number;
    bufferAfter?: number;
  }>;
}

/**
 * Respuesta de capacidad técnica
 * Endpoint: GET /internal/tech/capacity
 */
export interface BackendTechnicalCapacityResponse {
  date: string;              // yyyy-MM-dd
  blockMinutes?: number;
  defaultSlots?: number;
  maxCapacity?: number;
  blocks: Array<{
    from?: string;           // HH:mm
    to?: string;             // HH:mm
    time?: string;           // HH:mm legacy
    used: number;
    available: number;
  }>;
}

/**
 * Respuesta de conflictos de prioridad
 * Endpoint: GET /internal/priority/conflicts
 */
export interface BackendPriorityConflictsResponse {
  eventId: number;
  conflicts: Array<{
    conflictCode: string;
    displacedEventId: number;
    displacedEventName: string;
    displacedEventDate: string;      // yyyy-MM-dd
    displacedEventTime: string;      // "HH:mm - HH:mm"
    status: PriorityConflictStatus;
    createdAt: string;               // ISO 8601
  }>;
}

/**
 * DTO para registrar decisión de conflicto de prioridad
 * Endpoint: POST /internal/priority/decisions
 */
export interface BackendPriorityDecisionDTO {
  conflictCode: string;
  decision: 'KEEP_NEW' | 'KEEP_DISPLACED';
  target: 'DISPLACING_EVENT' | 'DISPLACED_EVENT';
}

/**
 * Respuesta de decisión de conflicto de prioridad
 * Endpoint: POST /internal/priority/decisions
 */
export interface BackendPriorityDecisionResult {
  conflictCode: string;
  decision: 'KEEP_NEW' | 'KEEP_DISPLACED';
  status: 'RESOLVED';
}

/**
 * DTO para enviar solicitud pública
 * Endpoint: POST /public/event-requests
 */
export interface BackendSubmitPublicRequestDTO {
  date: string;                      // yyyy-MM-dd
  technicalSchedule?: string | null; // HH:mm
  scheduleFrom: string;              // HH:mm
  scheduleTo: string;                // HH:mm
  name: string;
  spaceId: number | null;
  freeLocation: string | null;
  requestingDepartmentId: number | null;
  requirements?: string | null;
  coverage?: string | null;
  observations?: string | null;
  priority: Priority;
  audienceType: AudienceType;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
}

/**
 * Respuesta de envío de solicitud pública
 * Endpoint: POST /public/event-requests
 */
export interface BackendSubmitPublicRequestResponse {
  trackingUuid: string;
  status: PublicRequestStatus;
  submittedAt: string;           // ISO 8601
}

/**
 * DTO de usuario autenticado
 * Endpoint: GET /auth/me
 */
export interface BackendMeDTO {
  id: number;
  username: string;
  email: string;
  name: string;
  lastName: string;
  role: UserRole;
}

// ==================== RESPUESTAS PAGINADAS DE SPRING BOOT ====================

/**
 * Respuesta paginada genérica de Spring Boot
 */
export interface BackendPageResponse<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      unsorted: boolean;
      sorted: boolean;
    };
    offset: number;
    unpaged: boolean;
    paged: boolean;
  };
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  numberOfElements: number;
  sort: {
    empty: boolean;
    unsorted: boolean;
    sorted: boolean;
  };
}

// ==================== DTOs PÚBLICOS (SIN AUTENTICACIÓN) ====================

/**
 * DTO para crear Solicitud de Evento Público
 * Endpoint: POST /public/event-requests
 */
export interface PublicEventRequestPayload {
  name: string;
  audienceType: string;
  date: string;                    // formato: yyyy-MM-dd
  scheduleFrom: string;            // formato: HH:mm
  scheduleTo: string;              // formato: HH:mm
  technicalSchedule?: string | null; // formato: HH:mm
  spaceId?: number | null;         // XOR con freeLocation
  freeLocation?: string | null;    // XOR con spaceId
  requestingDepartmentId?: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  requirements?: string | null;
  coverage?: string | null;
  observations?: string | null;
}

/**
 * DTO de respuesta al crear Solicitud Pública
 * Endpoint: POST /public/event-requests
 * 
 * NOTA: El backend usa snake_case para estos campos
 */
export interface EventRequestCreatedResponse {
  tracking_uuid: string;           // UUID para tracking público (snake_case del backend)
  status: string;                  // ej: "RECIBIDO" (RequestStatus)
  request_date: string;            // ISO 8601 (snake_case del backend)
}

/**
 * DTO de respuesta de estado de Solicitud Pública
 * Endpoint: GET /public/track/{uuid}
 */
export interface EventRequestStatusResponse {
  trackingUuid: string;
  name: string;
  /** Motivo comunicado al rechazar la solicitud; null si no está rechazada. */
  rejectionReason: string | null;
  request: {
    status: 'RECIBIDO' | 'EN_REVISION' | 'CONVERTIDO' | 'RECHAZADO';
    submittedAt: string;          // ISO 8601
  };
  /** Estado del evento creado al convertir la solicitud; null si aún no se convirtió. */
  event: {
    status: string;
  } | null;
  schedule: {
    date: string;                 // formato: yyyy-MM-dd
    from: string;                 // formato: HH:mm
    to: string;                   // formato: HH:mm
  };
  location: {
    type: 'SPACE' | 'FREE';
    spaceName: string | null;
    freeLocation: string | null;
  };
  /** Sólo hitos públicos: cambios de estado y de agenda, sin detalles internos. */
  timeline: Array<{
    at: string;                   // ISO 8601
    scope: 'REQUEST' | 'EVENT';
    type: 'STATUS' | 'SCHEDULE_CHANGE';
    from: string | null;
    to: string | null;
  }>;
}

/**
 * DTO de request para verificar disponibilidad
 * Endpoint: POST /public/availability/check
 */
export interface AvailabilityCheckRequest {
  date: string;                    // formato: yyyy-MM-dd
  scheduleFrom: string;            // formato: HH:mm
  scheduleTo: string;              // formato: HH:mm
  technicalSchedule?: string | null; // formato: HH:mm
  spaceId?: number | null;         // XOR con freeLocation
  freeLocation?: string | null;    // XOR con spaceId
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
}

/**
 * DTO de respuesta de disponibilidad
 * Endpoint: POST /public/availability/check
 */
export interface AvailabilityCheckResponse {
  available: boolean;
  reason?: string | null;          // Razón si no está disponible
  existingEvents?: Array<{
    id: number;
    name: string;
    scheduleFrom: string;
    scheduleTo: string;
    status: string;
  }> | null;
}

/**
 * DTO de Espacio Público (lista simplificada)
 * Endpoint: GET /public/catalogs/spaces
 */
export interface PublicSpaceListItem {
  id: number;
  name: string;
  capacity?: number | null;
  location?: string | null;
  active: boolean;
  publishable: boolean;
}

/**
 * DTO de Ocupación Mensual de Espacio
 * Endpoint: GET /public/spaces/{id}/occupancy
 */
export interface SpaceOccupancyResponse {
  spaceId: number;
  spaceName: string;
  year: number;
  month: number;                   // 1-12
  events: Array<{
    eventId: number;
    eventName?: string | null;
    date: string;                  // formato: yyyy-MM-dd
    scheduleFrom: string;          // formato: HH:mm
    scheduleTo: string;            // formato: HH:mm
    technicalSchedule?: string | null;
    status: string;
    bufferBeforeMin?: number;
    bufferAfterMin?: number;
  }>;
}

/**
 * DTO de Item de Conflicto (HTTP 409)
 * Representa un evento que entra en conflicto con el evento candidato
 */
export interface ConflictItem {
  eventId: number;
  status: EventStatus;
  title: string;
  spaceId: number;
  date: string;                    // formato: yyyy-MM-dd
  from: string;                    // formato: HH:mm
  to: string;                      // formato: HH:mm
  internal: boolean;
  bufferBeforeMin: number | null;
  bufferAfterMin: number | null;
}

/**
 * DTO de Respuesta de Conflicto de Disponibilidad (HTTP 409)
 * Retornada por POST /api/events cuando hay conflicto de disponibilidad
 * Endpoint: POST /api/events (cuando retorna 409)
 */
export interface AvailabilityConflictResponse {
  isAvailable: boolean;
  skipped: boolean;
  reason: string | null;
  effectiveFrom: string;           // formato: HH:mm
  effectiveTo: string;             // formato: HH:mm
  conflicts: ConflictItem[];
}
