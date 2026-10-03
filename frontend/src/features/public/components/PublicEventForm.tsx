/**
 * ===================================================================
 * FORMULARIO DE SOLICITUD PÚBLICA DE EVENTO
 * ===================================================================
 * Permite a usuarios externos solicitar eventos sin autenticación.
 * Basado en InternalEventForm pero simplificado para público.
 * 
 * Características:
 * - NO requiere autenticación
 * - Prioridad fija en MEDIUM (oculta)
 * - Auto-verificación de disponibilidad
 * - Panel de ocupación siempre visible
 * - Tracking UUID al finalizar
 * ===================================================================
 */

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

// Schema y tipos
import {
  publicEventSchema,
  type PublicEventFormInput,
  type PublicEventFormData,
  toPublicEventRequestPayload,
} from '@/schemas/eventPublic.schema';

// API
import { publicRequestsApi, availabilityApi } from '@/services/api';
import type { SpaceOccupancyResult, AvailabilityResult } from '@/services/api';

// Componentes de formulario reutilizables
import {
  FormSectionCard,
  DateField,
  TimeField,
} from '@/components/form';
import FormField from '@/components/form/FormField';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Componentes específicos públicos
import PublicSpaceSelect from './PublicSpaceSelect';
import SpaceOccupancyPanel from './SpaceOccupancyPanel';
import AvailabilityChecker from './AvailabilityChecker';
import PublicAudienceTypeSelect from './PublicAudienceTypeSelect';

/**
 * Formulario completo de solicitud pública de eventos
 */
export default function PublicEventForm() {
  const navigate = useNavigate();

  // ========== STATE ==========
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationType, setLocationType] = useState<'space' | 'free'>('space');

  // Disponibilidad
  const [occupancy, setOccupancy] = useState<SpaceOccupancyResult | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  // ========== FORM SETUP ==========
  const form = useForm<PublicEventFormInput, unknown, PublicEventFormData>({
    resolver: zodResolver(publicEventSchema),
    defaultValues: {
      audienceType: 'COMUNIDAD',
      bufferBeforeMin: 15,
      bufferAfterMin: 15,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = form;

  // Watch values
  const spaceIdValue = watch('spaceId');
  const dateValue = watch('date');
  const scheduleFromValue = watch('scheduleFrom');
  const scheduleToValue = watch('scheduleTo');
  const bufferBeforeValue = watch('bufferBeforeMin');
  const bufferAfterValue = watch('bufferAfterMin');

  // ========== EFFECTS ==========

  // Cargar ocupación del espacio cuando cambia espacio o fecha
  useEffect(() => {
    if (spaceIdValue && dateValue) {
      loadSpaceOccupancy(spaceIdValue, dateValue);
    } else {
      setOccupancy(null);
    }
  }, [spaceIdValue, dateValue]);

  // Auto-verificar disponibilidad cuando cambian campos relevantes
  useEffect(() => {
    if (
      spaceIdValue &&
      dateValue &&
      scheduleFromValue &&
      scheduleToValue &&
      locationType === 'space'
    ) {
      // Debounce: esperar 500ms después del último cambio
      const timer = setTimeout(() => {
        checkAvailability();
      }, 500);

      return () => clearTimeout(timer);
    } else {
      setAvailability(null);
    }
  }, [
    spaceIdValue,
    dateValue,
    scheduleFromValue,
    scheduleToValue,
    bufferBeforeValue,
    bufferAfterValue,
  ]);

  // ========== HANDLERS ==========

  /**
   * Carga panel de ocupación del espacio
   */
  const loadSpaceOccupancy = async (spaceId: number, date: string) => {
    try {
      // Extraer año y mes de la fecha yyyy-MM-dd
      const [year, month] = date.split('-').map(Number);
      const occupancyData = await publicRequestsApi.getSpaceMonthlyOccupancy(spaceId, year, month);
      
      // Adaptar SpaceOccupancyResponse a SpaceOccupancyResult
      const result: SpaceOccupancyResult = {
        spaceId: occupancyData.spaceId,
        spaceName: occupancyData.spaceName,
        date: date,
        occupied: occupancyData.events.map(evt => ({
          from: evt.scheduleFrom,
          to: evt.scheduleTo,
          eventName: evt.eventName || 'Sin nombre',
          status: evt.status as any,
        })),
        availableSlots: [], // No necesario para el panel
      };
      setOccupancy(result);
    } catch (error) {
      console.error('Error al cargar ocupación:', error);
      toast.error('No se pudo cargar la ocupación del espacio');
    }
  };

  /**
   * Verifica disponibilidad del horario seleccionado
   */
  const checkAvailability = async () => {
    if (!spaceIdValue || !dateValue || !scheduleFromValue || !scheduleToValue) {
      return;
    }

    setIsCheckingAvailability(true);

    try {
      const result = await availabilityApi.checkPublicAvailability({
        spaceId: spaceIdValue,
        date: dateValue,
        scheduleFrom: scheduleFromValue,
        scheduleTo: scheduleToValue,
        bufferBeforeMin: bufferBeforeValue,
        bufferAfterMin: bufferAfterValue,
      });

      setAvailability({
        ...result,
        conflicts: result.conflicts.map((conflict) => ({
          ...conflict,
          // The public availability response intentionally omits event titles.
          eventName: conflict.eventName || 'Evento existente',
        })),
      });

      // Toast según resultado
      if (result.available) {
        toast.success('✅ Horario disponible', {
          description: result.message || 'El espacio está libre para el horario seleccionado',
        });
      } else {
        toast.warning('⚠️ Conflicto detectado', {
          description: `Hay ${result.conflicts.length} evento(s) en ese horario`,
        });
      }
    } catch (error) {
      console.error('Error al verificar disponibilidad:', error);
      toast.error('No se pudo verificar la disponibilidad');
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  /**
   * Handler de cambio de tipo de ubicación
   */
  const handleLocationTypeChange = (type: 'space' | 'free') => {
    setLocationType(type);

    // Limpiar campo no seleccionado
    if (type === 'space') {
      setValue('freeLocation', undefined);
      setOccupancy(null);
      setAvailability(null);
    } else {
      setValue('spaceId', undefined);
      setOccupancy(null);
      setAvailability(null);
    }
  };

  /**
   * Submit del formulario
   */
  const onSubmit = async (data: PublicEventFormData) => {
    // Validación final: si es espacio físico, debe estar disponible
    if (locationType === 'space' && availability && !availability.available) {
      toast.error('No se puede enviar la solicitud', {
        description: 'El horario seleccionado no está disponible. Por favor, elija otro.',
        duration: 5000,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Convertir a payload del backend
      const payload = toPublicEventRequestPayload(data);

      // Crear solicitud
      const response = await publicRequestsApi.createPublicEventRequest(payload);

      // Éxito
      toast.success('✅ Solicitud enviada', {
        description: 'Su solicitud ha sido recibida y será revisada por el equipo.',
        duration: 5000,
      });

      // Redirigir a pantalla de confirmación con tracking UUID
      navigate(`/solicitud/confirmacion/${response.tracking_uuid}`);
    } catch (error: any) {
      console.error('Error al crear solicitud:', error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Error desconocido al enviar la solicitud';

      toast.error('❌ Error al enviar solicitud', {
        description: errorMessage,
        duration: 7000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handler de cancelar
   */
  const handleCancel = () => {
    navigate('/login', { replace: true });
  };

  // ========== RENDER ==========
  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* ==================== HEADER ==================== */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Solicitud de Evento
        </h1>
        <p className="text-muted-foreground">
          Complete el formulario para solicitar un evento. Los campos marcados con{' '}
          <span className="text-red-600">*</span> son obligatorios.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Su solicitud será revisada por el equipo de Ceremonial y Técnica. Recibirá un código de
          seguimiento al finalizar.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ==================== SECCIÓN: DATOS DEL EVENTO ==================== */}
        <FormSectionCard title="Datos del Evento" description="Información básica del evento">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre del evento */}
            <FormField
              label="Nombre del evento"
              htmlFor="name"
              required
              error={errors.name?.message}
              className="md:col-span-2"
            >
              <Input
                id="name"
                type="text"
                placeholder="Ej: Conferencia sobre Inteligencia Artificial"
                maxLength={200}
                aria-invalid={!!errors.name}
                {...register('name')}
              />
            </FormField>

            {/* Tipo de audiencia */}
            <FormField
              label="Tipo de audiencia"
              htmlFor="audienceType"
              required
              error={errors.audienceType?.message}
              helpText="¿A quién está dirigido el evento?"
              className="md:col-span-2"
            >
              <Controller
                name="audienceType"
                control={control}
                render={({ field }) => (
                  <PublicAudienceTypeSelect
                    value={field.value}
                    onChange={field.onChange}
                    ariaInvalid={!!errors.audienceType}
                  />
                )}
              />
            </FormField>
          </div>
        </FormSectionCard>

        {/* ==================== SECCIÓN: HORARIOS ==================== */}
        <FormSectionCard title="Fecha y Horarios" description="Cuándo se realizará el evento">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fecha */}
            <FormField
              label="Fecha"
              htmlFor="date"
              required
              error={errors.date?.message}
              helpText="DD/MM/AAAA"
            >
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DateField
                    id="date"
                    value={field.value}
                    onChange={field.onChange}
                    ariaInvalid={!!errors.date}
                  />
                )}
              />
            </FormField>

            {/* Hora desde */}
            <FormField
              label="Hora de inicio"
              htmlFor="scheduleFrom"
              required
              error={errors.scheduleFrom?.message}
              helpText="HH:mm (24h)"
            >
              <Controller
                name="scheduleFrom"
                control={control}
                render={({ field }) => (
                  <TimeField
                    id="scheduleFrom"
                    value={field.value}
                    onChange={field.onChange}
                    ariaInvalid={!!errors.scheduleFrom}
                  />
                )}
              />
            </FormField>

            {/* Hora hasta */}
            <FormField
              label="Hora de fin"
              htmlFor="scheduleTo"
              required
              error={errors.scheduleTo?.message}
              helpText="HH:mm (24h)"
            >
              <Controller
                name="scheduleTo"
                control={control}
                render={({ field }) => (
                  <TimeField
                    id="scheduleTo"
                    value={field.value}
                    onChange={field.onChange}
                    ariaInvalid={!!errors.scheduleTo}
                  />
                )}
              />
            </FormField>
          </div>

          {/* Validación cruzada */}
          {scheduleFromValue && scheduleToValue && scheduleFromValue >= scheduleToValue && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                ⚠️ La hora de inicio debe ser anterior a la hora de fin
              </AlertDescription>
            </Alert>
          )}

          {/* Link al Calendario Público */}
          <Alert className="mt-4">
            <AlertDescription>
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Revisá el calendario antes de enviar tu solicitud
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Para evitar superposiciones de fecha y espacio, consultá los eventos ya programados.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <Link to="/public/calendar" target="_blank" className="inline-flex items-center gap-2">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Ver Calendario Público
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </Link>
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </FormSectionCard>

        {/* ==================== SECCIÓN: UBICACIÓN ==================== */}
        <FormSectionCard title="Ubicación del Evento" description="Dónde se realizará el evento">
          {/* Selector de tipo */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">
              Tipo de ubicación <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="locationType"
                  value="space"
                  checked={locationType === 'space'}
                  onChange={() => handleLocationTypeChange('space')}
                  className="w-4 h-4"
                />
                <span className="text-sm">Espacio de la universidad</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="locationType"
                  value="free"
                  checked={locationType === 'free'}
                  onChange={() => handleLocationTypeChange('free')}
                  className="w-4 h-4"
                />
                <span className="text-sm">Otra ubicación</span>
              </label>
            </div>
          </div>

          {/* Campo: Espacio físico */}
          {locationType === 'space' && (
            <>
              <FormField
                label="Espacio"
                htmlFor="spaceId"
                required
                error={errors.spaceId?.message}
                helpText="Seleccione el espacio donde se realizará el evento"
              >
                <PublicSpaceSelect
                  value={spaceIdValue}
                  onChange={(spaceId: number | null) => setValue('spaceId', spaceId ?? undefined)}
                  error={errors.spaceId?.message}
                />
              </FormField>

              {/* Panel de ocupación */}
              {spaceIdValue && dateValue && (
                <div className="mt-4">
                  <SpaceOccupancyPanel
                    occupancy={occupancy}
                    isLoading={!occupancy}
                    selectedFrom={scheduleFromValue}
                    selectedTo={scheduleToValue}
                  />
                </div>
              )}
            </>
          )}

          {/* Campo: Ubicación libre */}
          {locationType === 'free' && (
            <FormField
              label="Ubicación"
              htmlFor="freeLocation"
              required
              error={errors.freeLocation?.message}
              helpText="Describa la ubicación del evento (máx. 200 caracteres)"
            >
              <Input
                id="freeLocation"
                type="text"
                placeholder="Ej: Centro Cultural Municipal, Av. Principal 123"
                maxLength={200}
                aria-invalid={!!errors.freeLocation}
                {...register('freeLocation')}
              />
            </FormField>
          )}
        </FormSectionCard>

        {/* ==================== SECCIÓN: DISPONIBILIDAD ==================== */}
        {locationType === 'space' && spaceIdValue && (
          <AvailabilityChecker
            availability={availability}
            isChecking={isCheckingAvailability}
            onRecheck={checkAvailability}
          />
        )}

        {/* ==================== SECCIÓN: BUFFERS ==================== */}
        <FormSectionCard
          title="Tiempos de Preparación"
          description="Tiempo adicional antes y después del evento"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buffer antes */}
            <FormField
              label="Tiempo antes del evento"
              htmlFor="bufferBeforeMin"
              error={errors.bufferBeforeMin?.message}
              helpText="Minutos para preparación (0-240)"
            >
              <div className="flex items-center gap-2">
                <Input
                  id="bufferBeforeMin"
                  type="number"
                  min="0"
                  max="240"
                  step="5"
                  aria-invalid={!!errors.bufferBeforeMin}
                  {...register('bufferBeforeMin', { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </FormField>

            {/* Buffer después */}
            <FormField
              label="Tiempo después del evento"
              htmlFor="bufferAfterMin"
              error={errors.bufferAfterMin?.message}
              helpText="Minutos para limpieza (0-240)"
            >
              <div className="flex items-center gap-2">
                <Input
                  id="bufferAfterMin"
                  type="number"
                  min="0"
                  max="240"
                  step="5"
                  aria-invalid={!!errors.bufferAfterMin}
                  {...register('bufferAfterMin', { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </FormField>
          </div>

          {/* Información contextual */}
          <Alert className="mt-4">
            <AlertDescription>
              Los tiempos de preparación bloquean el espacio antes y después del evento para
              permitir montaje y desmontaje. Por defecto: 15 minutos.
            </AlertDescription>
          </Alert>
        </FormSectionCard>

        {/* ==================== SECCIÓN: CONTACTO ==================== */}
        <FormSectionCard
          title="Datos de Contacto"
          description="Información de la persona responsable"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre */}
            <FormField
              label="Nombre completo"
              htmlFor="contactName"
              required
              error={errors.contactName?.message}
            >
              <Input
                id="contactName"
                type="text"
                placeholder="Ej: Juan Pérez"
                maxLength={120}
                aria-invalid={!!errors.contactName}
                {...register('contactName')}
              />
            </FormField>

            {/* Email */}
            <FormField
              label="Email"
              htmlFor="contactEmail"
              required
              error={errors.contactEmail?.message}
            >
              <Input
                id="contactEmail"
                type="email"
                placeholder="Ej: juan.perez@example.com"
                maxLength={120}
                aria-invalid={!!errors.contactEmail}
                {...register('contactEmail')}
              />
            </FormField>

            {/* Teléfono */}
            <FormField
              label="Teléfono"
              htmlFor="contactPhone"
              required
              error={errors.contactPhone?.message}
              helpText="Incluya código de área"
              className="md:col-span-2"
            >
              <Input
                id="contactPhone"
                type="tel"
                placeholder="Ej: +54 9 11 1234-5678"
                maxLength={30}
                aria-invalid={!!errors.contactPhone}
                {...register('contactPhone')}
              />
            </FormField>
          </div>
        </FormSectionCard>

        {/* ==================== SECCIÓN: NOTAS OPCIONALES ==================== */}
        <FormSectionCard
          title="Información Adicional"
          description="Detalles opcionales del evento"
        >
          <div className="space-y-6">
            {/* Requerimientos */}
            <FormField
              label="Requerimientos especiales"
              htmlFor="requirements"
              error={errors.requirements?.message}
              helpText="Máximo 500 caracteres"
            >
              <textarea
                id="requirements"
                rows={3}
                placeholder="Ej: Proyector, micrófono, pizarra..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
                maxLength={500}
                aria-invalid={!!errors.requirements}
                {...register('requirements')}
              />
            </FormField>

            {/* Cobertura */}
            <FormField
              label="Cobertura deseada"
              htmlFor="coverage"
              error={errors.coverage?.message}
              helpText="Máximo 500 caracteres"
            >
              <textarea
                id="coverage"
                rows={3}
                placeholder="Ej: Streaming, fotografía, grabación..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
                maxLength={500}
                aria-invalid={!!errors.coverage}
                {...register('coverage')}
              />
            </FormField>

            {/* Observaciones */}
            <FormField
              label="Observaciones"
              htmlFor="observations"
              error={errors.observations?.message}
              helpText="Máximo 1000 caracteres"
            >
              <textarea
                id="observations"
                rows={4}
                placeholder="Cualquier información adicional..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
                maxLength={1000}
                aria-invalid={!!errors.observations}
                {...register('observations')}
              />
            </FormField>
          </div>
        </FormSectionCard>

        {/* ==================== BOTONES DE ACCIÓN ==================== */}
        <div className="flex justify-end gap-4 pt-6 border-t">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancelar
          </Button>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Enviando...
              </>
            ) : (
              'Enviar Solicitud'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
