import { z } from 'zod';

import type { Event, Priority, AudienceType, TechSupportMode } from '@/models/event';

const DATE_FORMAT_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ARGENTINE_PHONE_REGEX = /^(\+?54)?[\s-]?9?[\s-]?\d{2,4}[\s-]?\d{6,8}$/;

const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const audienceTypeSchema = z.enum([
  'ESTUDIANTES',
  'DOCENTES',
  'AUTORIDADES',
  'COMUNIDAD',
  'TERCERA_EDAD',
]);
const techSupportModeSchema = z.enum(['SETUP_ONLY', 'ATTENDED']);

const optionalTimeStringSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || TIME_FORMAT_REGEX.test(value), {
    message: 'La hora debe estar en formato HH:mm',
  });

const baseEventFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(200, 'El nombre no puede superar los 200 caracteres'),
    departmentId: z
      .number()
      .int('Departamento inválido')
      .positive('Debe seleccionar un departamento')
      .nullable()
      .refine((value) => value !== null, {
        message: 'Debe seleccionar un departamento',
      }),
    requestingArea: z.string().trim().max(150, 'El área solicitante no puede superar los 150 caracteres'),
    priority: prioritySchema,
    audienceType: z.union([audienceTypeSchema, z.literal('')]),
    internal: z.boolean(),
    date: z
      .string()
      .trim()
      .regex(DATE_FORMAT_REGEX, 'La fecha debe estar en formato yyyy-MM-dd'),
    scheduleFrom: z
      .string()
      .trim()
      .regex(TIME_FORMAT_REGEX, 'La hora debe estar en formato HH:mm'),
    scheduleTo: z
      .string()
      .trim()
      .regex(TIME_FORMAT_REGEX, 'La hora debe estar en formato HH:mm'),
    spaceId: z
      .number()
      .int('Espacio inválido')
      .positive('Debe seleccionar un espacio válido')
      .nullable(),
    freeLocation: z.string().trim().max(200, 'La ubicación libre no puede superar los 200 caracteres'),
    bufferBeforeMin: z
      .number()
      .int('El buffer debe ser un número entero')
      .min(0, 'El buffer mínimo es 0 minutos')
      .max(240, 'El buffer máximo es 240 minutos'),
    bufferAfterMin: z
      .number()
      .int('El buffer debe ser un número entero')
      .min(0, 'El buffer mínimo es 0 minutos')
      .max(240, 'El buffer máximo es 240 minutos'),
    requiresTech: z.boolean(),
    techSupportMode: z.union([techSupportModeSchema, z.literal('')]),
    technicalSchedule: optionalTimeStringSchema,
    requirements: z.string().max(255, 'Los requerimientos no pueden superar los 255 caracteres'),
    coverage: z.string().max(500, 'La cobertura no puede superar los 500 caracteres'),
    observations: z.string().max(1000, 'Las observaciones no pueden superar los 1000 caracteres'),
    contactName: z
      .string()
      .trim()
      .min(2, 'El nombre del contacto debe tener al menos 2 caracteres')
      .max(120, 'El nombre del contacto no puede superar los 120 caracteres'),
    contactEmail: z
      .string()
      .trim()
      .min(1, 'El email del contacto es requerido')
      .max(120, 'El email del contacto no puede superar los 120 caracteres')
      .email('Debe ingresar un email válido'),
    contactPhone: z
      .string()
      .trim()
      .min(1, 'El teléfono del contacto es requerido')
      .max(30, 'El teléfono del contacto no puede superar los 30 caracteres')
      .regex(ARGENTINE_PHONE_REGEX, 'Formato de teléfono argentino inválido'),
  })
  .superRefine((data, ctx) => {
    const hasSpace = data.spaceId !== null;
    const hasFreeLocation = data.freeLocation.trim().length > 0;

    if (hasSpace === hasFreeLocation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['freeLocation'],
        message: 'Debe indicar un espacio físico o una ubicación libre, pero no ambos',
      });
    }

    if (data.scheduleFrom >= data.scheduleTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduleTo'],
        message: 'La hora de fin debe ser posterior a la hora de inicio',
      });
    }

    if (data.requiresTech && data.techSupportMode === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['techSupportMode'],
        message: 'Debe indicar el modo de soporte técnico',
      });
    }

    if (data.requiresTech && data.technicalSchedule !== '' && data.technicalSchedule >= data.scheduleFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['technicalSchedule'],
        message: 'El horario técnico debe ser anterior al inicio del evento',
      });
    }
  });

const getNowInArgentina = (): Date => {
  const now = new Date();
  const argentinaTime = now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' });
  return new Date(argentinaTime);
};

export const eventFormSchema = baseEventFormSchema;

export const createEventFormSchema = baseEventFormSchema.superRefine((data, ctx) => {
  const nowArgentina = getNowInArgentina();
  const [year, month, day] = data.date.split('-').map(Number);
  const [hour, minute] = data.scheduleFrom.split(':').map(Number);
  const eventDateTime = new Date(year, month - 1, day, hour, minute);
  const minimumAllowedTime = new Date(nowArgentina.getTime() + 60 * 60 * 1000);

  if (eventDateTime < minimumAllowedTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scheduleFrom'],
      message: 'El evento debe programarse al menos 1 hora después de la hora actual',
    });
  }
});

export const editEventFormSchema = baseEventFormSchema;

export type EventFormValues = z.infer<typeof eventFormSchema>;
export type CreateEventFormValues = z.infer<typeof createEventFormSchema>;
export type EditEventFormValues = z.infer<typeof editEventFormSchema>;

export const eventFormDefaults: EventFormValues = {
  name: '',
  departmentId: null,
  requestingArea: '',
  priority: 'MEDIUM',
  audienceType: '',
  internal: true,
  date: '',
  scheduleFrom: '',
  scheduleTo: '',
  spaceId: null,
  freeLocation: '',
  bufferBeforeMin: 15,
  bufferAfterMin: 15,
  requiresTech: false,
  techSupportMode: '',
  technicalSchedule: '',
  requirements: '',
  coverage: '',
  observations: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
};

export function toEventFormValues(event: Event): EventFormValues {
  return {
    name: event.name ?? '',
    departmentId: event.departmentId ?? event.department?.id ?? null,
    requestingArea: event.requestingArea ?? '',
    priority: event.priority,
    audienceType: event.audienceType ?? '',
    internal: event.internal,
    date: event.date,
    scheduleFrom: event.scheduleFrom,
    scheduleTo: event.scheduleTo,
    spaceId: event.spaceId ?? event.space?.id ?? null,
    freeLocation: event.freeLocation ?? '',
    bufferBeforeMin: event.bufferBeforeMin ?? 0,
    bufferAfterMin: event.bufferAfterMin ?? 0,
    requiresTech: event.requiresTech,
    techSupportMode: event.techSupportMode ?? '',
    technicalSchedule: event.technicalSchedule ?? '',
    requirements: event.requirements ?? '',
    coverage: event.coverage ?? '',
    observations: event.observations ?? '',
    contactName: event.contactName ?? '',
    contactEmail: event.contactEmail ?? '',
    contactPhone: event.contactPhone ?? '',
  };
}

export function toCreateEventInput(values: EventFormValues): Partial<Event> & {
  name: string;
  date: string;
  scheduleFrom: string;
  scheduleTo: string;
  priority: Priority;
  internal: boolean;
  requiresTech: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  audienceType?: AudienceType;
  techSupportMode?: TechSupportMode | null;
} {
  return {
    name: values.name.trim(),
    date: values.date,
    scheduleFrom: values.scheduleFrom,
    scheduleTo: values.scheduleTo,
    departmentId: values.departmentId ?? undefined,
    requestingArea: values.requestingArea.trim(),
    priority: values.priority,
    audienceType: values.audienceType === '' ? undefined : values.audienceType,
    internal: values.internal,
    spaceId: values.spaceId ?? undefined,
    freeLocation: values.freeLocation.trim() || undefined,
    bufferBeforeMin: values.bufferBeforeMin,
    bufferAfterMin: values.bufferAfterMin,
    requiresTech: values.requiresTech,
    techSupportMode: values.requiresTech
      ? values.techSupportMode === ''
        ? undefined
        : values.techSupportMode
      : null,
    technicalSchedule: values.technicalSchedule || undefined,
    requirements: values.requirements.trim(),
    coverage: values.coverage.trim(),
    observations: values.observations.trim(),
    contactName: values.contactName.trim(),
    contactEmail: values.contactEmail.trim(),
    contactPhone: values.contactPhone.trim(),
  };
}
