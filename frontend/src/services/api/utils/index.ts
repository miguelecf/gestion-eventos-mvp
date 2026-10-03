/**
 * ===================================================================
 * UTILS INDEX - Barrel Export de Utilidades
 * ===================================================================
 * Exportaciones centralizadas de todas las utilidades de API
 * ===================================================================
 */

// Query Builder
export {
  QueryBuilder,
  createQueryBuilder,
  buildPaginationQuery,
  buildPaginationWithSortQuery,
  buildDateRangeQuery,
  buildSearchQuery,
  parseQueryString,
  mergeQueryStrings,
  removeQueryParams,
  updateQueryParam
} from './query-builder';

export type {
  PaginationOptions,
  SortOptions,
  FilterValue,
  DateRangeOptions,
  SearchOptions
} from './query-builder';

// Validation Schemas
export {
  ValidationSchemas,
  EventTypeSchema,
  EventStatusSchema,
  PublicRequestStatusSchema,
  emailSchema,
  phoneSchema,
  dateStringSchema,
  dateRangeSchema,
  createEventSchema,
  updateEventSchema,
  changeEventStatusSchema,
  createCommentSchema,
  updateCommentSchema,
  quickReactionSchema,
  checkAvailabilitySchema,
  findAvailableSlotSchema,
  submitPublicRequestSchema,
  trackPublicRequestSchema,
  paginationSchema,
  sortSchema,
  eventFiltersSchema,
  commentFiltersSchema,
  auditFiltersSchema
} from './validation-schemas';

// Validators
export {
  validateWithSchema,
  validateOrThrow,
  formatZodErrors,
  getFieldError,
  groupErrorsByField,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidISODate,
  isValidDateRange,
  isNotPastDate,
  isDateInRange,
  hasValidLength,
  isPositiveNumber,
  isInteger,
  isNonEmptyArray,
  isNonEmptyObject,
  sanitizeString,
  normalizeEmail,
  normalizePhone,
  escapeHtml,
  sanitizeInput,
  hasValidExtension,
  hasValidFileSize,
  hasValidMimeType,
  validateEventForm,
  validateComment,
  validatePublicRequest
} from './validators';

export type {
  ValidationResult,
  ValidationError
} from './validators';

// Error Handler
export {
  isAxiosError,
  isValidationError,
  isNetworkError,
  isAuthError,
  isNotFoundError,
  isConflictError,
  isServerError,
  classifyError,
  handleApiError,
  extractErrorMessage,
  formatErrorMessage,
  getUserFriendlyMessage,
  formatValidationErrors,
  formatErrorList,
  logError,
  logCriticalError,
  retryWithBackoff,
  safeAsync,
  createApiError
} from './error-handler';

export type {
  ApiErrorType,
  ApiError,
  ErrorFormatOptions
} from './error-handler';
