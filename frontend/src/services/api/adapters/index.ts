/**
 * Barrel export para adaptadores
 * Facilita imports: import { adaptSpringPage, toBackendDate } from '@/services/api/adapters'
 */

// Date adapters
export {
  toBackendDate,
  fromBackendDate,
  fromBackendTime,
  toBackendTime,
  fromBackendTimestamp,
  toBackendTimestamp,
  formatDisplayDate,
  formatDisplayTime,
  formatDisplayTimestamp,
  combineDateAndTime,
  isNotPastDate,
  isDateInRange
} from './date.adapter';

// Pagination adapters
export {
  adaptSpringPage,
  adaptArrayToPage,
  adaptCustomPage,
  adaptAuditPage,
  adaptCommentsPage,
  buildPaginationQuery,
  buildSortParam,
  buildSortParams,
  calculateOffset,
  calculatePage,
  hasNextPage,
  hasPreviousPage,
  createEmptyPage
} from './pagination.adapter';

// Event adapters (FASE 2)
export {
  adaptEventFromBackend,
  adaptEventsFromBackend,
  adaptEventForCreate,
  adaptEventForUpdate,
  canEditEvent,
  canChangeEventStatus,
  getEventStatusColor,
  getEventPriorityColor
} from './event.adapter';

// Comment adapters (FASE 2)
export {
  adaptCommentFromBackend,
  adaptCommentsFromBackend,
  adaptCommentsPageFromBackend,
  adaptCommentForCreate,
  adaptCommentForUpdate,
  canEditComment,
  canDeleteComment,
  getCommentAge,
  getCommentVisibilityColor,
  validateCommentBody
} from './comment.adapter';

// Event Status adapters
export {
  mapStatusFromBackend,
  mapStatusesFromBackend,
  adaptEventStatusFromBackend,
  adaptChangeStatusForBackend,
  adaptChangeStatusFromBackend,
  isTransitionAllowed,
  requiresReason,
  getTransitionMessage
} from './event-status.adapter';

// Audit adapters (FASE 2)
export {
  adaptAuditEntryFromBackend,
  adaptAuditEntriesFromBackend,
  adaptAuditPageFromBackend,
  groupAuditEntriesByDate,
  groupAuditEntriesByAction,
  groupAuditEntriesByActor,
  filterAuditEntriesByAction,
  filterAuditEntriesByDateRange,
  filterAuditEntriesByActor,
  getAuditEntryAge,
  formatAuditEntryDate,
  getAuditSummary,
  getActionTypeLabel
} from './audit.adapter';

// Re-export types from adapters
export type {
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
} from './comment.adapter';
export type { AuditEntry } from './audit.adapter';
