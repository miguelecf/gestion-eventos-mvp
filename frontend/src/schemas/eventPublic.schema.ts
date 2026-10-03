/**
 * ===================================================================
 * SCHEMA: Evento Público (Solicitud)
 * ===================================================================
 * Validaciones con Zod para formulario de solicitud de evento público.
 * Basado en eventInternal.schema.ts pero adaptado para usuarios externos.
 * ===================================================================
 */

import { z } from 'zod';
import { emailSchema } from '@/services/api/utils/validation-schemas';

// ==================== ENUMS REUTILIZADOS ====================

/**
 * Enum de Tipo de Audiencia (obligatorio en versión pública)
 * Nota: Incluye TERCERA_EDAD según backend
 */
export const PublicAudienceTypeSchema = z.enum([
  'ESTUDIANTES',
  'DOCENTES',
  'AUTORIDADES',
  'COMUNIDAD',
  'TERCERA_EDAD',
]);
export type PublicAudienceType = z.infer<typeof PublicAudienceTypeSchema>;

// ==================== VALIDACIONES CUSTOM ====================

/**
 * Validación de fecha futura (fecha debe ser hoy o posterior)
 */
const futureDateValidation = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
};

/**
 * Validación de formato de fecha yyyy-MM-dd
 */
const dateFormatRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Validación de formato de hora HH:mm (24h)
 */
const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Validación de teléfono (flexible para público)
 * Acepta formatos internacionales y locales
 */
const flexiblePhoneRegex = /^[\d\s\-+()]{8,30}$/;

// ==================== SCHEMA PRINCIPAL ====================

/**
 * Schema de validación para formulario de evento público
 *
 * CAMPOS REQUERIDOS:
 * - name: Nombre del evento (3-200 chars)
 * - audienceType: Tipo de audiencia (obligatorio en público)
 * - date: Fecha del evento (yyyy-MM-dd, hoy o futura)
 * - scheduleFrom: Hora de inicio (HH:mm)
 * - scheduleTo: Hora de fin (HH:mm, debe ser > scheduleFrom)
 * - spaceId o freeLocation: Ubicación del evento (XOR)
 * - contactName: Nombre del contacto (min 3 chars)
 * - contactEmail: Email válido
 * - contactPhone: Teléfono (formato flexible)
 *
 * CAMPOS OPCIONALES:
 * - requestingDepartmentId: Departamento solicitante
 * - technicalSchedule: Horario técnico (si aplica)
 * - bufferBeforeMin: Buffer antes (default: 15)
 * - bufferAfterMin: Buffer después (default: 15)
 * - requirements: Requerimientos especiales
 * - coverage: Cobertura esperada
 * - observations: Observaciones adicionales
 */
export const publicEventSchema = z
  .object({
    // ========== DATOS DEL EVENTO ==========
    name: z
      .string()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(200, 'El nombre no puede exceder 200 caracteres')
      .trim(),

    audienceType: PublicAudienceTypeSchema,

    // ========== HORARIOS ==========
    date: z
      .string()
      .regex(dateFormatRegex, 'La fecha debe estar en formato yyyy-MM-dd (ej: 2025-12-15)')
      .refine(futureDateValidation, {
        message: 'La fecha debe ser hoy o posterior',
      }),

    scheduleFrom: z
      .string()
      .regex(timeFormatRegex, 'La hora debe estar en formato HH:mm (ej: 09:30)'),

    scheduleTo: z
      .string()
      .regex(timeFormatRegex, 'La hora debe estar en formato HH:mm (ej: 14:30)'),

    technicalSchedule: z
      .string()
      .regex(timeFormatRegex, 'La hora debe estar en formato HH:mm (ej: 08:00)')
      .optional(),

    // ========== UBICACIÓN (XOR) ==========
    spaceId: z
      .number()
      .int('El ID del espacio debe ser un número entero')
      .positive('Debe seleccionar un espacio válido')
      .optional(),

    freeLocation: z
      .string()
      .min(1, 'Debe especificar una ubicación')
      .max(200, 'La ubicación no puede exceder 200 caracteres')
      .trim()
      .optional(),

    // ========== ORGANIZACIÓN ==========
    requestingDepartmentId: z
      .number()
      .int('El ID del departamento debe ser un número entero')
      .positive('Debe seleccionar un departamento válido')
      .optional(),

    // ========== CONTACTO ==========
    contactName: z
      .string()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(120, 'El nombre no puede exceder 120 caracteres')
      .trim(),

    contactEmail: emailSchema,

    contactPhone: z
      .string()
      .regex(flexiblePhoneRegex, 'Formato de teléfono inválido')
      .min(8, 'El teléfono debe tener al menos 8 caracteres')
      .max(30, 'El teléfono no puede exceder 30 caracteres')
      .trim(),

    // ========== BUFFERS DE TIEMPO ==========
    bufferBeforeMin: z
      .number()
      .int('El buffer debe ser un número entero')
      .min(0, 'El buffer debe ser al menos 0 minutos')
      .max(240, 'El buffer no puede exceder 240 minutos')
      .default(15),

    bufferAfterMin: z
      .number()
      .int('El buffer debe ser un número entero')
      .min(0, 'El buffer debe ser al menos 0 minutos')
      .max(240, 'El buffer no puede exceder 240 minutos')
      .default(15),

    // ========== DETALLES ADICIONALES ==========
    requirements: z
      .string()
      .max(500, 'Los requerimientos no pueden exceder 500 caracteres')
      .trim()
      .optional(),

    coverage: z
      .string()
      .max(500, 'La cobertura no puede exceder 500 caracteres')
      .trim()
      .optional(),

    observations: z
      .string()
      .max(1000, 'Las observaciones no pueden exceder 1000 caracteres')
      .trim()
      .optional(),
  })
  // ========== VALIDACIONES CRUZADAS ==========
  .refine(
    (data) => {
      // XOR: Debe tener spaceId O freeLocation, no ambos ni ninguno
      return (
        (data.spaceId && !data.freeLocation) ||
        (!data.spaceId && data.freeLocation)
      );
    },
    {
      message:
        'Debe seleccionar un espacio físico O especificar una ubicación libre',
      path: ['spaceId'],
    }
  )
  .refine(
    (data) => {
      // scheduleFrom debe ser anterior a scheduleTo
      if (!data.scheduleFrom || !data.scheduleTo) return true;
      return data.scheduleFrom < data.scheduleTo;
    },
    {
      message: 'La hora de inicio debe ser anterior a la hora de fin',
      path: ['scheduleTo'],
    }
  )
  .refine(
    (data) => {
      // Si tiene technicalSchedule, debe ser anterior a scheduleFrom
      if (!data.technicalSchedule || !data.scheduleFrom) return true;
      return data.technicalSchedule < data.scheduleFrom;
    },
    {
      message: 'El horario técnico debe ser anterior al inicio del evento',
      path: ['technicalSchedule'],
    }
  );

/**
 * Tipo de entrada cruda del formulario
 */
export type PublicEventFormInput = z.input<typeof publicEventSchema>;

/**
 * Tipo validado/sanitizado del schema
 */
export type PublicEventFormData = z.output<typeof publicEventSchema>;

// ==================== ADAPTADORES PARA API ====================

/**
 * Convierte datos del formulario público al formato del backend
 *
 * IMPORTANTE: Siempre envía priority="MEDIUM" (fijo, no editable por usuario)
 */
export function toPublicEventRequestPayload(data: PublicEventFormData) {
  return {
    // Datos del evento
    date: data.date,
    scheduleFrom: data.scheduleFrom,
    scheduleTo: data.scheduleTo,
    technicalSchedule: data.technicalSchedule || null,
    name: data.name,

    // Ubicación (XOR)
    space_id: data.spaceId || null,
    free_location: data.freeLocation || null,

    // Organización
    requesting_department_id: data.requestingDepartmentId || null,

    // Detalles
    requirements: data.requirements || null,
    coverage: data.coverage || null,
    observations: data.observations || null,

    // Metadatos
    priority: 'MEDIUM' as const, // Fijo y no editable en el formulario público.
    audienceType: data.audienceType,

    // Contacto
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,

    // Buffers
    bufferBeforeMin: data.bufferBeforeMin,
    bufferAfterMin: data.bufferAfterMin,
  };
}

/**
 * Valores por defecto para el formulario público
 */
export const publicEventFormDefaults: Partial<PublicEventFormData> = {
  bufferBeforeMin: 15,
  bufferAfterMin: 15,
};

// ==================== HELPERS DE VALIDACIÓN ====================

/**
 * Valida si una fecha es hoy o futura
 */
export function isDateValid(dateStr: string): boolean {
  try {
    const schema = z
      .string()
      .regex(dateFormatRegex)
      .refine(futureDateValidation);
    schema.parse(dateStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida si un horario es válido (HH:mm)
 */
export function isTimeValid(timeStr: string): boolean {
  return timeFormatRegex.test(timeStr);
}

/**
 * Valida si scheduleFrom < scheduleTo
 */
export function isTimeRangeValid(from: string, to: string): boolean {
  return from < to;
}
