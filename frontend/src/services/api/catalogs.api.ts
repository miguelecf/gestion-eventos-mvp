/**
 * ===================================================================
 * SDK DE CONFLICTOS, PRIORIDAD Y CATÁLOGOS - API DE ALTO NIVEL
 * ===================================================================
 * Proporciona funciones para gestionar conflictos de prioridad,
 * espacios y departamentos (catálogos).
 * ===================================================================
 */

import { httpClient } from './client';
import { ENDPOINTS } from './client/config';
import { adaptSpringPage, buildPaginationQuery } from './adapters';
import type { 
  BackendSpaceDTO,
  BackendDepartmentDTO,
  BackendSubmitPublicRequestDTO,
  BackendSubmitPublicRequestResponse,
  BackendPageResponse
} from './types/backend.types';
import type { PageResponse, SpringPageResponse } from './types/pagination.types';
import type { Space, CreateSpaceInput, UpdateSpaceInput, SpaceFilters } from '@/models/space';
import type { Department, CreateDepartmentInput, UpdateDepartmentInput, DepartmentFilters } from '@/models/department';

// ==================== TIPOS ESPECÍFICOS DEL SDK ====================

// Space, CreateSpaceInput, UpdateSpaceInput y SpaceFilters ahora se importan desde @/models/space
// Department, CreateDepartmentInput, UpdateDepartmentInput y DepartmentFilters ahora se importan desde @/models/department

/**
 * Parámetros para solicitud pública de evento
 */
export interface PublicEventRequestInput {
  // Datos del evento
  eventName: string;
  eventDescription: string;
  date: string; // yyyy-MM-dd
  scheduleFrom: string; // HH:mm
  scheduleTo: string; // HH:mm
  audienceType: string;
  
  // Datos del solicitante
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  
  // Preferencias
  spaceId?: number;
  departmentId?: number;
}

/**
 * Resultado de solicitud pública
 */
export interface PublicRequestResult {
  trackingUuid: string;
  message: string;
  nextSteps: string[];
}

// ==================== FUNCIONES DE CATÁLOGOS ====================

/**
 * Lista espacios con filtros y paginación (versión avanzada)
 * 
 * @param filters - Filtros de búsqueda y paginación
 * @returns Página de espacios
 * 
 * @example
 * const page = await catalogsApi.listSpaces({
 *   q: 'aula',
 *   active: true,
 *   page: 0,
 *   size: 20
 * });
 */
export async function listSpaces(
  filters: SpaceFilters = {}
): Promise<PageResponse<Space>> {
  const query = buildPaginationQuery({
    page: filters.page,
    size: filters.size
  });
  
  // Agregar filtros específicos
  if (filters.q) {
    query.append('q', filters.q);
  }
  if (filters.active !== undefined) {
    query.append('active', String(filters.active));
  }
  if (filters.sort) {
    query.append('sort', filters.sort);
  }
  
  const response = await httpClient.get<SpringPageResponse<BackendSpaceDTO>>(
    `${ENDPOINTS.CATALOG_SPACES}?${query.toString()}`
  );
  
  return adaptSpringPage(response, (dto) => ({
    id: dto.id,
    name: dto.name,
    capacity: dto.capacity,
    location: dto.location,
    colorHex: dto.colorHex,
    defaultBufferBeforeMin: dto.defaultBufferBeforeMin,
    defaultBufferAfterMin: dto.defaultBufferAfterMin,
    active: dto.active,
    label: `${dto.name} (Cap: ${dto.capacity})`,
    isAvailable: dto.active
  }));
}

/**
 * Obtiene todos los espacios disponibles (versión simple, sin paginación)
 * 
 * @param includeInactive - Incluir espacios inactivos (default: false)
 * @returns Array de espacios
 * 
 * @example
 * const spaces = await catalogsApi.getSpaces();
 * spaces.forEach(space => {
 *   console.log(`${space.name} - Cap: ${space.capacity}`);
 * });
 */
export async function getSpaces(
  includeInactive: boolean = false
): Promise<Space[]> {
  // Verificar si el backend también devuelve Page<SpaceResponse>
  const response = await httpClient.get<BackendPageResponse<BackendSpaceDTO>>(
    ENDPOINTS.CATALOG_SPACES
  );

  const backendSpaces = response.content;

  const spaces: Space[] = backendSpaces.map(space => ({
    id: space.id,
    name: space.name,
    capacity: space.capacity,
    location: space.location,
    colorHex: space.colorHex,
    defaultBufferBeforeMin: space.defaultBufferBeforeMin,
    defaultBufferAfterMin: space.defaultBufferAfterMin,
    active: space.active,
    label: `${space.name} (Cap: ${space.capacity})`,
    isAvailable: space.active
  }));

  return includeInactive ? spaces : spaces.filter(s => s.active);
}

/**
 * Obtiene espacios públicos (sin autenticación)
 * 
 * @returns Array de espacios públicos activos
 * 
 * @example
 * const publicSpaces = await catalogsApi.getPublicSpaces();
 */
export async function getPublicSpaces(): Promise<Space[]> {
  const response = await httpClient.get<BackendPageResponse<BackendSpaceDTO>>(
    ENDPOINTS.CATALOG_SPACES_PUBLIC
  );

  const backendSpaces = response.content;

  return backendSpaces.map(space => ({
    id: space.id,
    name: space.name,
    capacity: space.capacity,
    location: space.location,
    colorHex: space.colorHex,
    defaultBufferBeforeMin: space.defaultBufferBeforeMin,
    defaultBufferAfterMin: space.defaultBufferAfterMin,
    active: space.active,
    label: `${space.name} (Cap: ${space.capacity})`,
    isAvailable: space.active
  }));
}

/**
 * Obtiene un espacio por ID
 * 
 * @param id - ID del espacio
 * @returns Espacio
 * 
 * @example
 * const space = await catalogsApi.getSpaceById(5);
 * console.log(space.name, space.capacity);
 */
export async function getSpaceById(id: number): Promise<Space> {
  const backendSpace = await httpClient.get<BackendSpaceDTO>(
    ENDPOINTS.CATALOG_SPACE_BY_ID(id)
  );

  return {
    id: backendSpace.id,
    name: backendSpace.name,
    capacity: backendSpace.capacity,
    location: backendSpace.location,
    colorHex: backendSpace.colorHex,
    defaultBufferBeforeMin: backendSpace.defaultBufferBeforeMin,
    defaultBufferAfterMin: backendSpace.defaultBufferAfterMin,
    active: backendSpace.active,
    label: `${backendSpace.name} (Cap: ${backendSpace.capacity})`,
    isAvailable: backendSpace.active
  };
}

/**
 * Crea un nuevo espacio
 * 
 * @param input - Datos del espacio
 * @returns Espacio creado
 * 
 * @example
 * const space = await catalogsApi.createSpace({
 *   name: 'Aula Magna',
 *   capacity: 200,
 *   location: 'Edificio A',
 *   colorHex: '#3498db',
 *   defaultBufferBeforeMin: 30,
 *   defaultBufferAfterMin: 30
 * });
 */
export async function createSpace(input: CreateSpaceInput): Promise<Space> {
  const body = {
    name: input.name,
    capacity: input.capacity,
    colorHex: input.colorHex || '#6B7280',
    defaultBufferBeforeMin: input.defaultBufferBeforeMin,
    defaultBufferAfterMin: input.defaultBufferAfterMin,
    active: input.active ?? true
  };
  
  const dto = await httpClient.post<BackendSpaceDTO>(
    ENDPOINTS.CATALOG_SPACES,
    body
  );
  
  return {
    id: dto.id,
    name: dto.name,
    capacity: dto.capacity,
    location: dto.location,
    colorHex: dto.colorHex,
    defaultBufferBeforeMin: dto.defaultBufferBeforeMin,
    defaultBufferAfterMin: dto.defaultBufferAfterMin,
    active: dto.active,
    label: `${dto.name} (Cap: ${dto.capacity})`,
    isAvailable: dto.active
  };
}

/**
 * Actualiza un espacio existente
 * 
 * @param id - ID del espacio
 * @param input - Campos a actualizar (parcial)
 * @returns Espacio actualizado
 * 
 * @example
 * const updated = await catalogsApi.updateSpace(5, {
 *   capacity: 250,
 *   active: false
 * });
 */
export async function updateSpace(
  id: number,
  input: UpdateSpaceInput
): Promise<Space> {
  const dto = await httpClient.patch<BackendSpaceDTO>(
    ENDPOINTS.CATALOG_SPACE_BY_ID(id),
    input
  );
  
  return {
    id: dto.id,
    name: dto.name,
    capacity: dto.capacity,
    location: dto.location,
    colorHex: dto.colorHex,
    defaultBufferBeforeMin: dto.defaultBufferBeforeMin,
    defaultBufferAfterMin: dto.defaultBufferAfterMin,
    active: dto.active,
    label: `${dto.name} (Cap: ${dto.capacity})`,
    isAvailable: dto.active
  };
}

/**
 * Obtiene todos los departamentos disponibles
 * 
 * @param includeInactive - Incluir departamentos inactivos (default: false)
 * @returns Array de departamentos
 * 
 * @example
 * const departments = await catalogsApi.getDepartments();
 * departments.forEach(dept => {
 *   console.log(dept.name);
 * });
 */
export async function getDepartments(
  includeInactive: boolean = false
): Promise<Department[]> {
  // El backend devuelve Page<DepartmentResponse>
  const response = await httpClient.get<BackendPageResponse<BackendDepartmentDTO>>(
    ENDPOINTS.CATALOG_DEPARTMENTS
  );

  // Extraer el array del objeto paginado
  const backendDepartments = response.content;

  const departments: Department[] = backendDepartments.map(dept => ({
    id: dept.id,
    name: dept.name,
    colorHex: dept.colorHex || '#6B7280', // Color por defecto si es null
    active: dept.active,
    isAvailable: dept.active
  }));

  return includeInactive ? departments : departments.filter(d => d.active);
}

/**
 * Obtiene un departamento por ID
 * 
 * @param id - ID del departamento
 * @returns Departamento
 * 
 * @example
 * const dept = await catalogsApi.getDepartmentById(10);
 * console.log(dept.name);
 */
export async function getDepartmentById(id: number): Promise<Department> {
  const backendDept = await httpClient.get<BackendDepartmentDTO>(
    ENDPOINTS.CATALOG_DEPARTMENT_BY_ID(id)
  );

  return {
    id: backendDept.id,
    name: backendDept.name,
    colorHex: backendDept.colorHex,
    active: backendDept.active,
    isAvailable: backendDept.active
  };
}

/**
 * Lista departamentos con filtros y paginación
 * 
 * @param filters - Filtros de búsqueda y paginación
 * @returns Página de departamentos
 * 
 * @example
 * const page = await catalogsApi.listDepartments({
 *   q: 'Investigación',
 *   active: true,
 *   page: 0,
 *   size: 20
 * });
 */
export async function listDepartments(
  filters: DepartmentFilters = {}
): Promise<PageResponse<Department>> {
  const query = buildPaginationQuery({
    page: filters.page,
    size: filters.size
  });
  
  if (filters.q) query.append('q', filters.q);
  if (filters.active !== undefined) query.append('active', String(filters.active));
  if (filters.sort) query.append('sort', filters.sort);
  
  const response = await httpClient.get<SpringPageResponse<BackendDepartmentDTO>>(
    `${ENDPOINTS.CATALOG_DEPARTMENTS}?${query.toString()}`
  );
  
  return adaptSpringPage(response, (dto) => ({
    id: dto.id,
    name: dto.name,
    colorHex: dto.colorHex || '#6B7280',
    active: dto.active,
    isAvailable: dto.active
  }));
}

/**
 * Crea un nuevo departamento
 * 
 * @param input - Datos del departamento a crear
 * @returns Departamento creado
 * 
 * @example
 * const newDept = await catalogsApi.createDepartment({
 *   name: 'Investigación y Desarrollo',
 *   colorHex: '#1abc9c',
 *   active: true
 * });
 */
export async function createDepartment(
  input: CreateDepartmentInput
): Promise<Department> {
  const body = {
    name: input.name,
    colorHex: input.colorHex || '#6B7280',
    active: input.active ?? true
  };
  
  const dto = await httpClient.post<BackendDepartmentDTO>(
    ENDPOINTS.CATALOG_DEPARTMENTS,
    body
  );
  
  return {
    id: dto.id,
    name: dto.name,
    colorHex: dto.colorHex || '#6B7280',
    active: dto.active,
    isAvailable: dto.active
  };
}

/**
 * Actualiza un departamento existente
 * 
 * @param id - ID del departamento
 * @param input - Datos a actualizar (parciales)
 * @returns Departamento actualizado
 * 
 * @example
 * const updated = await catalogsApi.updateDepartment(10, {
 *   colorHex: '#3498db',
 *   active: false
 * });
 */
export async function updateDepartment(
  id: number,
  input: UpdateDepartmentInput
): Promise<Department> {
  const dto = await httpClient.patch<BackendDepartmentDTO>(
    ENDPOINTS.CATALOG_DEPARTMENT_BY_ID(id),
    input
  );
  
  return {
    id: dto.id,
    name: dto.name,
    colorHex: dto.colorHex || '#6B7280',
    active: dto.active,
    isAvailable: dto.active
  };
}

// ==================== FUNCIONES DE SOLICITUDES PÚBLICAS ====================

/**
 * Envía una solicitud pública de evento
 * Endpoint público (sin autenticación)
 * 
 * @param input - Datos de la solicitud
 * @returns Resultado con UUID de seguimiento
 * 
 * @example
 * const result = await catalogsApi.submitPublicRequest({
 *   eventName: 'Conferencia Tecnología',
 *   eventDescription: 'Charla sobre IA',
 *   date: '2025-12-15',
 *   scheduleFrom: '10:00',
 *   scheduleTo: '12:00',
 *   audienceType: 'COMUNIDAD',
 *   contactName: 'Juan Pérez',
 *   contactEmail: 'juan@example.com',
 *   contactPhone: '+54911234567',
 *   spaceId: 5,
 *   departmentId: 2
 * });
 * 
 * console.log(`Código de seguimiento: ${result.trackingUuid}`);
 */
export async function submitPublicRequest(
  input: PublicEventRequestInput
): Promise<PublicRequestResult> {
  const requestBody: BackendSubmitPublicRequestDTO = {
    name: input.eventName,
    date: input.date,
    scheduleFrom: input.scheduleFrom,
    scheduleTo: input.scheduleTo,
    audienceType: input.audienceType as any,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    space_id: input.spaceId ?? null,
    free_location: null,
    requesting_department_id: input.departmentId ?? null,
    requirements: input.eventDescription,
    priority: 'MEDIUM', // Default para solicitudes públicas
    bufferBeforeMin: 15,
    bufferAfterMin: 15
  };

  const response = await httpClient.post<BackendSubmitPublicRequestResponse>(
    ENDPOINTS.PUBLIC_EVENT_REQUESTS,
    requestBody
  );

  return {
    trackingUuid: response.tracking_uuid,
    message: '✅ Solicitud enviada exitosamente',
    nextSteps: [
      `Guarda este código de seguimiento: ${response.tracking_uuid}`,
      'Recibirás un email de confirmación',
      'Puedes consultar el estado en cualquier momento',
      'Te notificaremos cuando se procese tu solicitud'
    ]
  };
}

// ==================== HELPERS Y UTILIDADES ====================

/**
 * Obtiene espacios agrupados por capacidad
 * 
 * @returns Espacios organizados por rango de capacidad
 * 
 * @example
 * const grouped = await catalogsApi.getSpacesByCapacity();
 * console.log('Pequeños:', grouped.small.map(s => s.name));
 * console.log('Medianos:', grouped.medium.map(s => s.name));
 * console.log('Grandes:', grouped.large.map(s => s.name));
 */
export async function getSpacesByCapacity(): Promise<{
  small: Space[];  // < 30 personas
  medium: Space[]; // 30-100 personas
  large: Space[];  // > 100 personas
}> {
  const spaces = await getSpaces();
  
  return {
    small: spaces.filter(s => s.capacity < 30),
    medium: spaces.filter(s => s.capacity >= 30 && s.capacity <= 100),
    large: spaces.filter(s => s.capacity > 100)
  };
}

/**
 * Encuentra el espacio más adecuado para un número de asistentes
 * 
 * @param expectedAttendees - Número esperado de asistentes
 * @param buffer - Porcentaje de buffer adicional (default: 1.1 = 10%)
 * @returns Espacio más apropiado o null
 * 
 * @example
 * const space = await catalogsApi.findBestSpace(45);
 * if (space) {
 *   console.log(`Recomendado: ${space.name} (Cap: ${space.capacity})`);
 * }
 */
export async function findBestSpace(
  expectedAttendees: number,
  buffer: number = 1.1
): Promise<Space | null> {
  const spaces = await getSpaces();
  const requiredCapacity = Math.ceil(expectedAttendees * buffer);
  
  // Filtrar espacios con capacidad suficiente
  const suitable = spaces.filter(s => s.capacity >= requiredCapacity);
  
  if (suitable.length === 0) return null;
  
  // Ordenar por capacidad (menor primero) y retornar el más ajustado
  return suitable.sort((a, b) => a.capacity - b.capacity)[0];
}

// ==================== EXPORT DEFAULT ====================

/**
 * API de Conflictos, Prioridad y Catálogos - Objeto con todas las funciones
 * Permite importar como: import { catalogsApi } from '@/services/api'
 */
export const catalogsApi = {
  // Catálogos de espacios
  listSpaces,        // ✅ Con paginación y filtros
  getSpaces,         // ✅ Mantener para compatibilidad
  getPublicSpaces,
  getSpaceById,
  createSpace,       // ✅ CRUD
  updateSpace,       // ✅ CRUD
  getSpacesByCapacity,
  findBestSpace,
  
  // Catálogos de departamentos
  getDepartments,
  getDepartmentById,
  listDepartments,   // ✅ NUEVO - Con paginación y filtros
  createDepartment,  // ✅ NUEVO - CRUD
  updateDepartment,  // ✅ NUEVO - CRUD
  
  // Solicitudes públicas
  submitPublicRequest
};

export default catalogsApi;
