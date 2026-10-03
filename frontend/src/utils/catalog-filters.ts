/**
 * ===================================================================
 * CATALOG FILTERS - Búsqueda local en catálogos
 * ===================================================================
 * Helpers para filtrar colecciones de catálogos en memoria. Los endpoints también
 * aceptan el parámetro `q` para búsquedas paginadas en el servidor.
 * ===================================================================
 */

import type { Space } from '@/models/space';
import type { Department } from '@/models/department';

/**
 * Filtra espacios por query de búsqueda
 * Busca en: nombre
 * 
 * @param spaces - Lista de espacios a filtrar
 * @param query - Término de búsqueda
 * @returns Espacios que coinciden con la búsqueda
 * 
 * @example
 * ```ts
 * const spaces = await catalogsApi.getSpaces();
 * const filtered = filterSpaces(spaces, 'aula');
 * ```
 */
export function filterSpaces(spaces: Space[], query: string): Space[] {
  if (!query || query.trim() === '') {
    return spaces;
  }
  
  const q = query.toLowerCase().trim();
  
  return spaces.filter(space => 
    space.name.toLowerCase().includes(q)
  );
}

/**
 * Filtra departamentos por query de búsqueda
 * Busca en: nombre
 * 
 * @param departments - Lista de departamentos a filtrar
 * @param query - Término de búsqueda
 * @returns Departamentos que coinciden con la búsqueda
 * 
 * @example
 * ```ts
 * const departments = await catalogsApi.getDepartments();
 * const filtered = filterDepartments(departments, 'sistemas');
 * ```
 */
export function filterDepartments(departments: Department[], query: string): Department[] {
  if (!query || query.trim() === '') {
    return departments;
  }
  
  const q = query.toLowerCase().trim();
  
  return departments.filter(dept => 
    dept.name.toLowerCase().includes(q)
  );
}

/**
 * Ordena espacios por nombre alfabéticamente
 * 
 * @param spaces - Lista de espacios a ordenar
 * @returns Nueva lista ordenada (no muta el array original)
 * 
 * @example
 * ```ts
 * const sorted = sortSpacesByName(spaces);
 * ```
 */
export function sortSpacesByName(spaces: Space[]): Space[] {
  return [...spaces].sort((a, b) => 
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );
}

/**
 * Ordena departamentos por nombre alfabéticamente
 * 
 * @param departments - Lista de departamentos a ordenar
 * @returns Nueva lista ordenada (no muta el array original)
 * 
 * @example
 * ```ts
 * const sorted = sortDepartmentsByName(departments);
 * ```
 */
export function sortDepartmentsByName(departments: Department[]): Department[] {
  return [...departments].sort((a, b) => 
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );
}

/**
 * Filtra y ordena espacios en una sola operación
 * 
 * @param spaces - Lista de espacios
 * @param query - Término de búsqueda
 * @returns Espacios filtrados y ordenados alfabéticamente
 * 
 * @example
 * ```ts
 * const result = filterAndSortSpaces(spaces, 'aula');
 * ```
 */
export function filterAndSortSpaces(spaces: Space[], query: string): Space[] {
  const filtered = filterSpaces(spaces, query);
  return sortSpacesByName(filtered);
}

/**
 * Filtra y ordena departamentos en una sola operación
 * 
 * @param departments - Lista de departamentos
 * @param query - Término de búsqueda
 * @returns Departamentos filtrados y ordenados alfabéticamente
 * 
 * @example
 * ```ts
 * const result = filterAndSortDepartments(departments, 'sistemas');
 * ```
 */
export function filterAndSortDepartments(departments: Department[], query: string): Department[] {
  const filtered = filterDepartments(departments, query);
  return sortDepartmentsByName(filtered);
}

/**
 * Filtra espacios por capacidad mínima
 * 
 * @param spaces - Lista de espacios
 * @param minCapacity - Capacidad mínima requerida
 * @returns Espacios que cumplen con la capacidad mínima
 * 
 * @example
 * ```ts
 * const large = filterSpacesByCapacity(spaces, 50);
 * ```
 */
export function filterSpacesByCapacity(spaces: Space[], minCapacity: number): Space[] {
  return spaces.filter(space => space.capacity >= minCapacity);
}

/**
 * Filtra espacios activos
 * 
 * @param spaces - Lista de espacios
 * @returns Solo espacios activos
 * 
 * @example
 * ```ts
 * const active = filterActiveSpaces(spaces);
 * ```
 */
export function filterActiveSpaces(spaces: Space[]): Space[] {
  return spaces.filter(space => space.active);
}

/**
 * Filtra departamentos activos
 * 
 * @param departments - Lista de departamentos
 * @returns Solo departamentos activos
 * 
 * @example
 * ```ts
 * const active = filterActiveDepartments(departments);
 * ```
 */
export function filterActiveDepartments(departments: Department[]): Department[] {
  return departments.filter(dept => dept.active);
}
