/**
 * Barrel export para tipos de API
 * Facilita imports: import { ApiError, PageResponse } from '@/services/api/types'
 */

// API Types
export type {
  ApiError,
  ApiResponse,
  NoContentResponse,
  OperationResult,
  CreatedResponse,
  UpdatedResponse,
  DeletedResponse
} from './api.types';

// Pagination Types
export type {
  PaginationParams,
  SortParam,
  PageResponse,
  SpringPageResponse,
  CustomPageResponse,
  AnyPageResponse
} from './pagination.types';

// Backend DTOs y Enums
export {
  EventStatus,
  Priority,
  TechSupportMode,
  AudienceType,
  EventOriginType,
  UserRole,
  CommentVisibility,
  AuditActionType,
  PublicRequestStatus
} from './backend.types';

export type {
  BackendEventDTO,
  BackendEventCreateResult,
  BackendEventUpdateResult,
  BackendCreateEventDTO,
  BackendUpdateEventDTO,
  BackendStatusChangeResponse,
  BackendCommentDTO,
  BackendCommentsPage,
  BackendCreateCommentDTO,
  BackendUpdateCommentDTO,
  BackendAuditEntryDTO,
  BackendAuditPage,
  BackendSpaceDTO,
  BackendDepartmentDTO,
  BackendSpaceAvailabilityResponse,
  BackendTechnicalCapacityResponse,
  BackendSubmitPublicRequestDTO,
  BackendSubmitPublicRequestResponse,
  BackendMeDTO
} from './backend.types';
