/**
 * ===================================================================
 * VALIDATION SCHEMAS - Esquemas Zod para Runtime Validation
 * ===================================================================
 * Schemas de validación runtime con Zod para todos los DTOs
 * ===================================================================
 */

import { z } from 'zod';

// ==================== ENUMS ====================

export const EventTypeSchema = z.enum(['ACADEMICO', 'INSTITUCIONAL', 'CULTURAL', 'DEPORTIVO', 'OTRO']);
export const EventStatusSchema = z.enum(['APROBADO', 'CANCELADO', 'PENDIENTE', 'RECHAZADO', 'REPROGRAMADO']);
export const PublicRequestStatusSchema = z.enum(['RECIBIDO', 'EN_REVISION', 'CONVERTIDO', 'RECHAZADO']);

// ==================== SCHEMAS BÁSICOS ====================

/**
 * Schema para validar emails
 */
export const emailSchema = z.string().email('Email inválido');

/**
 * Schema para validar teléfonos (formato internacional o argentino)
 */
export const phoneSchema = z.string()
  .min(8, 'Teléfono debe tener al menos 8 dígitos')
  .max(15, 'Teléfono no puede tener más de 15 dígitos')
  .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, 'Formato de teléfono inválido');

/**
 * Schema para fechas ISO
 */
export const dateStringSchema = z.string().datetime({ message: 'Fecha debe estar en formato ISO 8601' });

/**
 * Schema para rangos de fechas
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
}).refine(data => new Date(data.startDate) < new Date(data.endDate), {
  message: 'La fecha de inicio debe ser anterior a la fecha de fin',
  path: ['endDate']
});

// ==================== EVENT SCHEMAS ====================

/**
 * Schema para crear evento
 */
export const createEventSchema = z.object({
  name: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(200, 'El nombre no puede superar 200 caracteres'),
  
  description: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(2000, 'La descripción no puede superar 2000 caracteres')
    .optional(),
  
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  
  type: EventTypeSchema,
  
  spaceId: z.number().int().positive('El ID del espacio debe ser positivo'),
  
  departmentId: z.number().int().positive('El ID del departamento debe ser positivo'),
  
  estimatedAttendees: z.number()
    .int()
    .min(1, 'Debe haber al menos 1 asistente')
    .max(10000, 'No puede haber más de 10,000 asistentes')
    .optional(),
  
  isPublic: z.boolean().optional(),
  
  requiresSetup: z.boolean().optional(),
  
  technicalRequirements: z.string()
    .max(1000, 'Los requerimientos técnicos no pueden superar 1000 caracteres')
    .optional()
}).refine(data => new Date(data.startDate) < new Date(data.endDate), {
  message: 'La fecha de inicio debe ser anterior a la fecha de fin',
  path: ['endDate']
});

/**
 * Schema para actualizar evento
 */
export const updateEventSchema = createEventSchema.partial();

/**
 * Schema para cambio de estado
 */
export const changeEventStatusSchema = z.object({
  eventId: z.number().int().positive(),
  newStatus: EventStatusSchema,
  reason: z.string()
    .min(10, 'La razón debe tener al menos 10 caracteres')
    .max(500, 'La razón no puede superar 500 caracteres')
    .optional()
});

// ==================== COMMENT SCHEMAS ====================

/**
 * Schema para crear comentario
 */
export const createCommentSchema = z.object({
  eventId: z.number().int().positive('El ID del evento debe ser positivo'),
  
  body: z.string()
    .min(1, 'El comentario no puede estar vacío')
    .max(1000, 'El comentario no puede superar 1000 caracteres'),
  
  isInternal: z.boolean().optional()
});

/**
 * Schema para actualizar comentario
 */
export const updateCommentSchema = z.object({
  body: z.string()
    .min(1, 'El comentario no puede estar vacío')
    .max(1000, 'El comentario no puede superar 1000 caracteres')
});

/**
 * Schema para reacción rápida
 */
export const quickReactionSchema = z.object({
  commentId: z.number().int().positive(),
  emoji: z.string().emoji('Debe ser un emoji válido')
});

// ==================== AVAILABILITY SCHEMAS ====================

/**
 * Schema para verificar disponibilidad
 */
export const checkAvailabilitySchema = z.object({
  spaceId: z.number().int().positive('El ID del espacio debe ser positivo'),
  
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  
  excludeEventId: z.number().int().positive().optional()
}).refine(data => new Date(data.startDate) < new Date(data.endDate), {
  message: 'La fecha de inicio debe ser anterior a la fecha de fin',
  path: ['endDate']
});

/**
 * Schema para búsqueda de primer slot disponible
 */
export const findAvailableSlotSchema = z.object({
  spaceId: z.number().int().positive(),
  durationHours: z.number()
    .min(0.5, 'La duración mínima es 30 minutos (0.5 horas)')
    .max(24, 'La duración máxima es 24 horas'),
  searchStartDate: z.string().datetime(),
  searchEndDate: z.string().datetime()
}).refine(data => new Date(data.searchStartDate) < new Date(data.searchEndDate), {
  message: 'La fecha de inicio de búsqueda debe ser anterior a la fecha de fin',
  path: ['searchEndDate']
});

// ==================== PUBLIC REQUEST SCHEMAS ====================

/**
 * Schema para solicitud pública
 */
export const submitPublicRequestSchema = z.object({
  requesterName: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  
  requesterEmail: emailSchema,
  
  requesterPhone: phoneSchema.optional(),
  
  eventName: z.string()
    .min(3, 'El nombre del evento debe tener al menos 3 caracteres')
    .max(200, 'El nombre del evento no puede superar 200 caracteres'),
  
  eventDescription: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(2000, 'La descripción no puede superar 2000 caracteres'),
  
  requestedStartDate: z.string().datetime(),
  requestedEndDate: z.string().datetime(),
  
  estimatedAttendees: z.number()
    .int()
    .min(1, 'Debe haber al menos 1 asistente')
    .max(10000, 'No puede haber más de 10,000 asistentes'),
  
  preferredSpaceId: z.number().int().positive().optional(),
  
  technicalRequirements: z.string()
    .max(1000, 'Los requerimientos técnicos no pueden superar 1000 caracteres')
    .optional()
}).refine(data => new Date(data.requestedStartDate) < new Date(data.requestedEndDate), {
  message: 'La fecha de inicio debe ser anterior a la fecha de fin',
  path: ['requestedEndDate']
});

/**
 * Schema para tracking de solicitud pública
 */
export const trackPublicRequestSchema = z.object({
  trackingCode: z.string()
    .min(8, 'El código de tracking debe tener al menos 8 caracteres')
    .max(50, 'El código de tracking no puede superar 50 caracteres')
});

// ==================== PAGINATION SCHEMAS ====================

/**
 * Schema para paginación
 */
export const paginationSchema = z.object({
  page: z.number().int().min(0, 'La página debe ser mayor o igual a 0').optional(),
  size: z.number().int().min(1, 'El tamaño debe ser al menos 1').max(100, 'El tamaño máximo es 100').optional()
});

/**
 * Schema para ordenamiento
 */
export const sortSchema = z.object({
  field: z.string().min(1, 'El campo de ordenamiento no puede estar vacío'),
  direction: z.enum(['ASC', 'DESC']).optional()
});

// ==================== FILTER SCHEMAS ====================

/**
 * Schema para filtros de eventos
 */
export const eventFiltersSchema = z.object({
  spaceId: z.number().int().positive().optional(),
  departmentId: z.number().int().positive().optional(),
  type: EventTypeSchema.optional(),
  status: EventStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isPublic: z.boolean().optional(),
  search: z.string().max(200).optional()
});

/**
 * Schema para filtros de comentarios
 */
export const commentFiltersSchema = z.object({
  eventId: z.number().int().positive().optional(),
  isInternal: z.boolean().optional(),
  authorId: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

/**
 * Schema para filtros de auditoría
 */
export const auditFiltersSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.number().int().positive().optional(),
  action: z.string().optional(),
  userId: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// ==================== EXPORT ALL ====================

export const ValidationSchemas = {
  // Básicos
  email: emailSchema,
  phone: phoneSchema,
  dateString: dateStringSchema,
  dateRange: dateRangeSchema,
  
  // Events
  createEvent: createEventSchema,
  updateEvent: updateEventSchema,
  changeEventStatus: changeEventStatusSchema,
  
  // Comments
  createComment: createCommentSchema,
  updateComment: updateCommentSchema,
  quickReaction: quickReactionSchema,
  
  // Availability
  checkAvailability: checkAvailabilitySchema,
  findAvailableSlot: findAvailableSlotSchema,
  
  // Public Requests
  submitPublicRequest: submitPublicRequestSchema,
  trackPublicRequest: trackPublicRequestSchema,
  
  // Pagination & Sort
  pagination: paginationSchema,
  sort: sortSchema,
  
  // Filters
  eventFilters: eventFiltersSchema,
  commentFilters: commentFiltersSchema,
  auditFilters: auditFiltersSchema
};

export default ValidationSchemas;
