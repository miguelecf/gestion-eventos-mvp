/**
 * ===================================================================
 * CATALOGS STORE - Integración con SDK
 * ===================================================================
 * Store de Zustand que integra catalogsApi SDK para gestión de catálogos
 * ===================================================================
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import {
  catalogsApi,
  type Space,
  type Department,
  type PublicEventRequestInput,
  type PublicRequestResult,
  type SpaceFilters,
  type CreateSpaceInput,
  type UpdateSpaceInput,
  type DepartmentFilters,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
  handleApiError,
  logError
} from '@/services/api';

// ==================== TIPOS ====================

export interface CatalogsStore {
  // ============ DATOS ============
  spaces: Space[];
  departments: Department[];
  
  // ============ PAGINACIÓN ============
  spacesPagination: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
  
  departmentsPagination: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
  
  // ============ FILTROS ============
  spacesFilters: {
    q: string;
    active?: boolean;
  };
  
  departmentsFilters: {
    q: string;
    active?: boolean;
  };
  
  // ============ ESTADO ============
  loading: {
    spaces: boolean;
    departments: boolean;
    publicRequest: boolean;
    createSpace: boolean;
    updateSpace: boolean;
    createDepartment: boolean;
    updateDepartment: boolean;
  };
  
  errors: {
    spaces: string | null;
    departments: string | null;
    publicRequest: string | null;
    createSpace: string | null;
    updateSpace: string | null;
    createDepartment: string | null;
    updateDepartment: string | null;
  };
  
  // ============ ACCIONES ============
  
  // Espacios - Listar con filtros y paginación
  listSpaces: (filters?: SpaceFilters) => Promise<void>;
  
  // Espacios - CRUD
  createSpace: (input: CreateSpaceInput) => Promise<Space | null>;
  updateSpace: (id: number, input: UpdateSpaceInput) => Promise<Space | null>;
  toggleActive: (id: number) => Promise<boolean>;
  
  // Espacios - Filtros
  setSpacesFilters: (filters: Partial<CatalogsStore['spacesFilters']>) => void;
  clearSpacesFilters: () => void;
  
  // Espacios - Paginación
  setSpacesPage: (page: number) => void;
  setSpacesSize: (size: number) => void;
  
  // Departamentos - Listar con filtros y paginación
  listDepartments: (filters?: DepartmentFilters) => Promise<void>;
  
  // Departamentos - CRUD
  createDepartment: (input: CreateDepartmentInput) => Promise<Department | null>;
  updateDepartment: (id: number, input: UpdateDepartmentInput) => Promise<Department | null>;
  toggleActiveDepartment: (id: number) => Promise<boolean>;
  
  // Departamentos - Filtros
  setDepartmentsFilters: (filters: Partial<CatalogsStore['departmentsFilters']>) => void;
  clearDepartmentsFilters: () => void;
  
  // Departamentos - Paginación
  setDepartmentsPage: (page: number) => void;
  setDepartmentsSize: (size: number) => void;
  
  // Existentes
  fetchSpaces: () => Promise<void>;
  fetchDepartments: () => Promise<void>;
  submitPublicRequest: (input: PublicEventRequestInput) => Promise<PublicRequestResult | null>;
  clearErrors: () => void;
  reset: () => void;
}

const initialState = {
  spaces: [],
  departments: [],
  spacesPagination: {
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  },
  departmentsPagination: {
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  },
  spacesFilters: {
    q: '',
    active: undefined,
  },
  departmentsFilters: {
    q: '',
    active: undefined,
  },
  loading: {
    spaces: false,
    departments: false,
    publicRequest: false,
    createSpace: false,
    updateSpace: false,
    createDepartment: false,
    updateDepartment: false,
  },
  errors: {
    spaces: null,
    departments: null,
    publicRequest: null,
    createSpace: null,
    updateSpace: null,
    createDepartment: null,
    updateDepartment: null,
  },
};

const createCatalogsStore: StateCreator<CatalogsStore> = (set, get) => ({
  ...initialState,
  
  // ============ LISTAR ESPACIOS CON PAGINACIÓN ============
  listSpaces: async (filters) => {
    const currentFilters = get().spacesFilters;
    const currentPagination = get().spacesPagination;
    
    const queryFilters: SpaceFilters = {
      q: filters?.q ?? currentFilters.q,
      active: filters?.active ?? currentFilters.active,
      page: filters?.page ?? currentPagination.page,
      size: filters?.size ?? currentPagination.size,
    };
    
    set((state) => ({
      loading: { ...state.loading, spaces: true },
      errors: { ...state.errors, spaces: null },
      spacesFilters: {
        q: queryFilters.q || '',
        active: queryFilters.active,
      },
    }));
    
    try {
      const page = await catalogsApi.listSpaces(queryFilters);
      
      set({
        spaces: page.content,
        spacesPagination: {
          page: page.page.number,
          size: page.page.size,
          totalElements: page.page.totalElements,
          totalPages: page.page.totalPages,
        },
        loading: { ...get().loading, spaces: false },
      });
    } catch (error) {
      logError(error, 'CatalogsStore.listSpaces');
      const apiError = handleApiError(error);
      set({
        loading: { ...get().loading, spaces: false },
        errors: { ...get().errors, spaces: apiError.message },
      });
    }
  },
  
  // ============ CREAR ESPACIO ============
  createSpace: async (input) => {
    set((state) => ({
      loading: { ...state.loading, createSpace: true },
      errors: { ...state.errors, createSpace: null },
    }));
    
    try {
      const newSpace = await catalogsApi.createSpace(input);
      
      // Refrescar lista manteniendo filtros
      await get().listSpaces();
      
      set({
        loading: { ...get().loading, createSpace: false },
      });
      
      return newSpace;
    } catch (error) {
      logError(error, 'CatalogsStore.createSpace');
      const apiError = handleApiError(error);
      set({
        loading: { ...get().loading, createSpace: false },
        errors: { ...get().errors, createSpace: apiError.message },
      });
      return null;
    }
  },
  
  // ============ ACTUALIZAR ESPACIO ============
  updateSpace: async (id, input) => {
    set((state) => ({
      loading: { ...state.loading, updateSpace: true },
      errors: { ...state.errors, updateSpace: null },
    }));
    
    try {
      const updatedSpace = await catalogsApi.updateSpace(id, input);
      
      // Actualización optimista en la lista
      set((state) => ({
        spaces: state.spaces.map(s => 
          s.id === id ? updatedSpace : s
        ),
        loading: { ...state.loading, updateSpace: false },
      }));
      
      return updatedSpace;
    } catch (error) {
      logError(error, 'CatalogsStore.updateSpace');
      const apiError = handleApiError(error);
      set({
        loading: { ...get().loading, updateSpace: false },
        errors: { ...get().errors, updateSpace: apiError.message },
      });
      return null;
    }
  },
  
  // ============ TOGGLE ACTIVO ============
  toggleActive: async (id) => {
    const space = get().spaces.find(s => s.id === id);
    if (!space) return false;
    
    const result = await get().updateSpace(id, { active: !space.active });
    return result !== null;
  },
  
  // ============ FILTROS ============
  setSpacesFilters: (filters) => {
    set((state) => ({
      spacesFilters: { ...state.spacesFilters, ...filters },
    }));
    
    // Auto-fetch con nuevos filtros (página 0)
    get().listSpaces({ page: 0 });
  },
  
  clearSpacesFilters: () => {
    set({
      spacesFilters: { q: '', active: undefined },
    });
    get().listSpaces({ page: 0 });
  },
  
  // ============ PAGINACIÓN ============
  setSpacesPage: (page) => {
    get().listSpaces({ page });
  },
  
  setSpacesSize: (size) => {
    get().listSpaces({ page: 0, size });
  },
  
  // ============ FUNCIONES EXISTENTES ============
  fetchSpaces: async () => {
    set((state) => ({
      loading: { ...state.loading, spaces: true },
      errors: { ...state.errors, spaces: null },
    }));
    
    try {
      const spaces = await catalogsApi.getSpaces();
      set({
        spaces,
        loading: { ...get().loading, spaces: false },
      });
    } catch (error) {
      logError(error, 'CatalogsStore.fetchSpaces');
      const apiError = handleApiError(error);
      set({
        loading: { ...get().loading, spaces: false },
        errors: { ...get().errors, spaces: apiError.message },
      });
    }
  },
  
  fetchDepartments: async () => {
    set((state) => ({
      loading: { ...state.loading, departments: true },
      errors: { ...state.errors, departments: null },
    }));
    
    try {
      const departments = await catalogsApi.getDepartments();
      set({
        departments,
        loading: { ...get().loading, departments: false },
      });
    } catch (error) {
      logError(error, 'CatalogsStore.fetchDepartments');
      const apiError = handleApiError(error);
      set({
        loading: { ...get().loading, departments: false },
        errors: { ...get().errors, departments: apiError.message },
      });
    }
  },
  
  // ============ LISTAR DEPARTAMENTOS CON PAGINACIÓN ============
  listDepartments: async (filters) => {
    const currentFilters = get().departmentsFilters;
    const currentPagination = get().departmentsPagination;
    
    const queryFilters: DepartmentFilters = {
      q: filters?.q ?? currentFilters.q,
      active: filters?.active ?? currentFilters.active,
      page: filters?.page ?? currentPagination.page,
      size: filters?.size ?? currentPagination.size,
    };
    
    set((state) => ({
      loading: { ...state.loading, departments: true },
      errors: { ...state.errors, departments: null },
      departmentsFilters: {
        q: queryFilters.q || '',
        active: queryFilters.active,
      },
    }));
    
    try {
      const page = await catalogsApi.listDepartments(queryFilters);
      
      set({
        departments: page.content,
        departmentsPagination: {
          page: page.page.number,
          size: page.page.size,
          totalElements: page.page.totalElements,
          totalPages: page.page.totalPages,
        },
        loading: { ...get().loading, departments: false },
      });
    } catch (error) {
      logError(error, 'CatalogsStore.listDepartments');
      const apiError = handleApiError(error);
      set({
        loading: { ...get().loading, departments: false },
        errors: { ...get().errors, departments: apiError.message },
      });
    }
  },
  
  // ============ CREAR DEPARTAMENTO ============
  createDepartment: async (input) => {
    set((state) => ({
      loading: { ...state.loading, createDepartment: true },
      errors: { ...state.errors, createDepartment: null },
    }));
    
    try {
      const newDepartment = await catalogsApi.createDepartment(input);
      
      // Refrescar lista manteniendo filtros
      await get().listDepartments();
      
      set({
        loading: { ...get().loading, createDepartment: false },
      });
      
      return newDepartment;
    } catch (error) {
      logError(error, 'CatalogsStore.createDepartment');
      const apiError = handleApiError(error);
      set({
        loading: { ...get().loading, createDepartment: false },
        errors: { ...get().errors, createDepartment: apiError.message },
      });
      return null;
    }
  },
  
  // ============ ACTUALIZAR DEPARTAMENTO ============
  updateDepartment: async (id, input) => {
    set((state) => ({
      loading: { ...state.loading, updateDepartment: true },
      errors: { ...state.errors, updateDepartment: null },
    }));
    
    try {
      const updatedDepartment = await catalogsApi.updateDepartment(id, input);
      
      // Actualización optimista en la lista
      set((state) => ({
        departments: state.departments.map(dept =>
          dept.id === id ? updatedDepartment : dept
        ),
        loading: { ...state.loading, updateDepartment: false },
      }));
      
      return updatedDepartment;
    } catch (error) {
      logError(error, 'CatalogsStore.updateDepartment');
      const apiError = handleApiError(error);
      set({
        loading: { ...get().loading, updateDepartment: false },
        errors: { ...get().errors, updateDepartment: apiError.message },
      });
      return null;
    }
  },
  
  // ============ TOGGLE ACTIVO DEPARTAMENTO ============
  toggleActiveDepartment: async (id) => {
    const department = get().departments.find(d => d.id === id);
    if (!department) return false;
    
    const result = await get().updateDepartment(id, { active: !department.active });
    return result !== null;
  },
  
  // ============ FILTROS DEPARTAMENTOS ============
  setDepartmentsFilters: (filters) => {
    set((state) => ({
      departmentsFilters: { ...state.departmentsFilters, ...filters },
    }));
    
    // Auto-fetch con nuevos filtros (página 0)
    get().listDepartments({ page: 0 });
  },
  
  clearDepartmentsFilters: () => {
    set({
      departmentsFilters: { q: '', active: undefined },
    });
    get().listDepartments({ page: 0 });
  },
  
  // ============ PAGINACIÓN DEPARTAMENTOS ============
  setDepartmentsPage: (page) => {
    get().listDepartments({ page });
  },
  
  setDepartmentsSize: (size) => {
    get().listDepartments({ page: 0, size });
  },
  
  submitPublicRequest: async (input: PublicEventRequestInput) => {
    set((state) => ({
      loading: { ...state.loading, publicRequest: true },
      errors: { ...state.errors, publicRequest: null },
    }));
    
    try {
      const result = await catalogsApi.submitPublicRequest(input);
      set({
        loading: { ...get().loading, publicRequest: false },
      });
      return result;
    } catch (error) {
      logError(error, 'CatalogsStore.submitPublicRequest');
      const apiError = handleApiError(error);
      set({
        loading: { ...get().loading, publicRequest: false },
        errors: { ...get().errors, publicRequest: apiError.message },
      });
      return null;
    }
  },
  
  clearErrors: () => {
    set({
      errors: {
        spaces: null,
        departments: null,
        publicRequest: null,
        createSpace: null,
        updateSpace: null,
        createDepartment: null,
        updateDepartment: null,
      },
    });
  },
  
  reset: () => {
    set(initialState);
  },
});

export const useCatalogsStore = create<CatalogsStore>()(
  devtools(createCatalogsStore, { name: 'CatalogsStore' })
);
