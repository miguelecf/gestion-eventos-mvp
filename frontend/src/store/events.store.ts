/**
 * ===================================================================
 * EVENTS STORE - Integración con SDK
 * ===================================================================
 * Store de Zustand que integra eventsApi SDK para gestión de eventos
 * ===================================================================
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import {
  eventsApi,
  type EventsQueryParams,
  type CreateEventInput,
  type UpdateEventInput,
  type ChangeStatusInput,
  handleApiError,
  logError
} from '@/services/api';
import type { Event, EventFilters, SortConfig, PaginationState } from '@/models/event';
import type { PageResponse } from '@/services/api/types';
import type { PresetName } from './presets';
import { PRESETS, getPresetConfig } from './presets';
import { parseSearchParams, serializeToSearchParams } from '@/utils/url-params';

// ==================== TIPOS ====================

/**
 * Estado de carga async
 */
export interface LoadingState {
  events: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  stats: boolean;
}

/**
 * Estado de errores
 */
export interface ErrorState {
  events: string | null;
  create: string | null;
  update: string | null;
  delete: string | null;
  stats: string | null;
}

/**
 * Store completo de eventos
 */
export interface EventsStore {
  // ==================== DATOS ====================
  
  /**
   * Lista de eventos (página actual)
   */
  events: Event[];
  
  /**
   * Evento seleccionado (para detalle)
   */
  selectedEvent: Event | null;
  
  /**
   * Estadísticas de eventos
   */
  stats: any | null;
  
  // ==================== ESTADO UI ====================
  
  /**
   * Filtros actuales
   */
  filters: EventFilters;
  
  /**
   * Paginación
   */
  pagination: PaginationState;
  
  /**
   * Ordenamiento (multi-columna)
   */
  sort: SortConfig[];
  
  /**
   * Preset activo
   */
  activePreset: PresetName | null;
  
  // ==================== ESTADO ASYNC ====================
  
  /**
   * Estados de carga
   */
  loading: LoadingState;
  
  /**
   * Errores
   */
  errors: ErrorState;
  
  /**
   * Timestamp de última actualización
   */
  lastFetch: number | null;
  
  // ==================== CACHÉ ====================
  
  /**
   * Caché de eventos por clave
   */
  cachedEvents: Record<string, Event[]>;
  
  // ==================== ACCIONES SDK ====================
  
  /**
   * Obtener lista de eventos con filtros actuales
   */
  fetchEvents: (forceRefresh?: boolean) => Promise<void>;
  
  /**
   * Obtener evento por ID
   */
  fetchEventById: (id: number) => Promise<Event | null>;
  
  /**
   * Crear nuevo evento
   */
  createEvent: (input: CreateEventInput) => Promise<Event | null>;
  
  /**
   * Actualizar evento existente
   */
  updateEvent: (id: number, input: UpdateEventInput) => Promise<Event | null>;
  
  /**
   * Eliminar evento
   */
  deleteEvent: (id: number) => Promise<boolean>;
  
  /**
   * Cambiar estado de evento
   */
  changeEventStatus: (eventId: number, input: ChangeStatusInput) => Promise<boolean>;
  
  /**
   * Obtener estadísticas
   */
  
  // ==================== ACCIONES UI ====================
  
  /**
   * Establecer filtros
   */
  setFilters: (filters: Partial<EventFilters>) => void;
  
  /**
   * Limpiar filtros
   */
  clearFilters: () => void;
  
  /**
   * Resetear filtros
   */
  resetFilters: () => void;
  
  /**
   * Establecer ordenamiento
   */
  setSort: (sorts: SortConfig[]) => void;
  
  /**
   * Agregar columna de ordenamiento
   */
  addSort: (field: SortConfig['field'], order: SortConfig['order']) => void;
  
  /**
   * Remover columna de ordenamiento
   */
  removeSort: (field: SortConfig['field']) => void;
  
  /**
   * Establecer página
   */
  setPage: (page: number) => void;
  
  /**
   * Establecer tamaño de página
   */
  setPageSize: (size: PaginationState['pageSize']) => void;
  
  /**
   * Siguiente página
   */
  nextPage: () => void;
  
  /**
   * Página anterior
   */
  prevPage: () => void;
  
  /**
   * Aplicar preset
   */
  applyPreset: (preset: PresetName) => void;
  
  /**
   * Sincronizar desde URL
   */
  syncFromURL: (params: URLSearchParams) => void;
  
  /**
   * Obtener parámetros URL
   */
  getURLParams: () => URLSearchParams;
  
  /**
   * Seleccionar evento
   */
  selectEvent: (event: Event | null) => void;
  
  /**
   * Limpiar errores
   */
  clearErrors: () => void;
  
  /**
   * Resetear store
   */
  reset: () => void;
}

// ==================== ESTADO INICIAL ====================

const initialState = {
  // Datos
  events: [],
  selectedEvent: null,
  stats: null,
  
  // UI
  filters: {},
  pagination: {
    page: 1,
    pageSize: 20 as const,
    total: 0,
    totalPages: 0,
  },
  sort: PRESETS.default.sort,
  activePreset: null,
  
  // Async
  loading: {
    events: false,
    create: false,
    update: false,
    delete: false,
    stats: false,
  },
  errors: {
    events: null,
    create: null,
    update: null,
    delete: null,
    stats: null,
  },
  lastFetch: null,
  
  // Caché
  cachedEvents: {},
};

// ==================== STORE CREATOR ====================

const createEventsStore: StateCreator<EventsStore> = (set, get) => ({
  ...initialState,
  
  // ==================== ACCIONES SDK ====================
  
  fetchEvents: async (forceRefresh = false) => {
    const { filters, pagination, sort, lastFetch } = get();
    
    // Caché simple: no refetch si ya se hizo hace menos de 30 segundos
    if (!forceRefresh && lastFetch && Date.now() - lastFetch < 30000) {
      return;
    }
    
    set((state) => ({
      loading: { ...state.loading, events: true },
      errors: { ...state.errors, events: null },
    }));
    
    try {
      // Construir parámetros de consulta
      const queryParams: EventsQueryParams = {
        page: pagination.page - 1, // Backend usa páginas base 0
        size: pagination.pageSize,
        ...filters,
      };
      
      // Agregar ordenamiento
      if (sort && sort.length > 0) {
        queryParams.sort = sort.map(s => ({
          field: s.field,
          direction: s.order.toUpperCase() as 'ASC' | 'DESC'
        }));
      }
      
      // Llamar al SDK
      const response: PageResponse<Event> = await eventsApi.getEvents(queryParams);
      
      set({
        events: response.content,
        pagination: {
          page: response.page.number + 1, // Convertir a base 1
          pageSize: response.page.size as 20 | 50 | 100,
          total: response.page.totalElements,
          totalPages: response.page.totalPages,
        },
        lastFetch: Date.now(),
        loading: { ...get().loading, events: false },
      });
    } catch (error) {
      logError(error, 'EventsStore.fetchEvents');
      
      const apiError = handleApiError(error);
      
      set({
        events: [],
        loading: { ...get().loading, events: false },
        errors: { ...get().errors, events: apiError.message },
      });
    }
  },
  
  fetchEventById: async (id: number) => {
    set((state) => ({
      loading: { ...state.loading, events: true },
      errors: { ...state.errors, events: null },
    }));
    
    try {
      const event = await eventsApi.getEventById(id);
      
      set({
        selectedEvent: event,
        loading: { ...get().loading, events: false },
      });
      
      return event;
    } catch (error) {
      logError(error, 'EventsStore.fetchEventById');
      
      const apiError = handleApiError(error);
      
      set({
        selectedEvent: null,
        loading: { ...get().loading, events: false },
        errors: { ...get().errors, events: apiError.message },
      });
      
      return null;
    }
  },
  
  createEvent: async (input: CreateEventInput) => {
    set((state) => ({
      loading: { ...state.loading, create: true },
      errors: { ...state.errors, create: null },
    }));
    
    try {
      const newEvent = await eventsApi.createEvent(input as any);
      
      set({
        loading: { ...get().loading, create: false },
      });
      
      // Refrescar lista
      await get().fetchEvents(true);
      
      return newEvent;
    } catch (error) {
      logError(error, 'EventsStore.createEvent');
      
      const apiError = handleApiError(error);
      
      set({
        loading: { ...get().loading, create: false },
        errors: { ...get().errors, create: apiError.message },
      });
      
      return null;
    }
  },
  
  updateEvent: async (id: number, input: UpdateEventInput) => {
    set((state) => ({
      loading: { ...state.loading, update: true },
      errors: { ...state.errors, update: null },
    }));
    
    try {
      const updatedEvent = await eventsApi.updateEvent(id, input);
      
      // Actualizar en la lista si existe
      set((state) => ({
        events: state.events.map(e => e.id === id ? updatedEvent : e),
        selectedEvent: state.selectedEvent?.id === id ? updatedEvent : state.selectedEvent,
        loading: { ...state.loading, update: false },
      }));
      
      return updatedEvent;
    } catch (error) {
      logError(error, 'EventsStore.updateEvent');
      
      const apiError = handleApiError(error);
      
      set({
        loading: { ...get().loading, update: false },
        errors: { ...get().errors, update: apiError.message },
      });
      
      return null;
    }
  },
  
  deleteEvent: async (id: number) => {
    set((state) => ({
      loading: { ...state.loading, delete: true },
      errors: { ...state.errors, delete: null },
    }));
    
    try {
      await eventsApi.deleteEvent(id);
      
      // Remover de la lista
      set((state) => ({
        events: state.events.filter(e => e.id !== id),
        selectedEvent: state.selectedEvent?.id === id ? null : state.selectedEvent,
        loading: { ...state.loading, delete: false },
      }));
      
      return true;
    } catch (error) {
      logError(error, 'EventsStore.deleteEvent');
      
      const apiError = handleApiError(error);
      
      set({
        loading: { ...get().loading, delete: false },
        errors: { ...get().errors, delete: apiError.message },
      });
      
      return false;
    }
  },
  
  changeEventStatus: async (eventId: number, input: ChangeStatusInput) => {
    set((state) => ({
      loading: { ...state.loading, update: true },
      errors: { ...state.errors, update: null },
    }));
    
    try {
      await eventsApi.changeEventStatus(eventId, input);
      
      // Refrescar evento
      await get().fetchEventById(eventId);
      
      // Refrescar lista
      await get().fetchEvents(true);
      
      set({
        loading: { ...get().loading, update: false },
      });
      
      return true;
    } catch (error) {
      logError(error, 'EventsStore.changeEventStatus');
      
      const apiError = handleApiError(error);
      
      set({
        loading: { ...get().loading, update: false },
        errors: { ...get().errors, update: apiError.message },
      });
      
      return false;
    }
  },
  
  // ==================== ACCIONES UI ====================
  
  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 },
    }));
    
    // ✅ REMOVED: Auto-fetch eliminado - componentes deben llamar fetchEvents() manualmente
    // get().fetchEvents(true);
  },
  
  clearFilters: () => {
    set({
      filters: {},
      pagination: { ...get().pagination, page: 1 },
    });
    
    // ✅ REMOVED: Auto-fetch eliminado
    // get().fetchEvents(true);
  },
  
  resetFilters: () => {
    const preset = get().activePreset || 'default';
    const config = PRESETS[preset];
    
    set({
      filters: { ...config.filters },
      pagination: { ...get().pagination, page: 1 },
    });
    
    // ✅ REMOVED: Auto-fetch eliminado
    // get().fetchEvents(true);
  },
  
  setSort: (sorts) => {
    set({ sort: sorts });
    // ✅ REMOVED: Auto-fetch eliminado
    // get().fetchEvents(true);
  },
  
  addSort: (field, order) => {
    set((state) => {
      const filtered = state.sort.filter(s => s.field !== field);
      return {
        sort: [...filtered, { field, order }],
      };
    });
    
    // ✅ REMOVED: Auto-fetch eliminado
    // get().fetchEvents(true);
  },
  
  removeSort: (field) => {
    set((state) => ({
      sort: state.sort.filter(s => s.field !== field),
    }));
    
    // ✅ REMOVED: Auto-fetch eliminado
    // get().fetchEvents(true);
  },
  
  setPage: (page) => {
    const { pagination } = get();
    
    if (page >= 1 && page <= pagination.totalPages) {
      set((state) => ({
        pagination: { ...state.pagination, page },
      }));
      
      // ✅ REMOVED: Auto-fetch eliminado
      // get().fetchEvents(true);
    }
  },
  
  setPageSize: (pageSize) => {
    set((state) => ({
      pagination: { ...state.pagination, pageSize, page: 1 },
    }));
    
    // ✅ REMOVED: Auto-fetch eliminado
    // get().fetchEvents(true);
  },
  
  nextPage: () => {
    const { pagination } = get();
    
    if (pagination.page < pagination.totalPages) {
      get().setPage(pagination.page + 1);
    }
  },
  
  prevPage: () => {
    const { pagination } = get();
    
    if (pagination.page > 1) {
      get().setPage(pagination.page - 1);
    }
  },
  
  applyPreset: (preset) => {
    const config = getPresetConfig(preset);
    
    set({
      filters: { ...config.filters },
      sort: [...config.sort],
      pagination: { ...get().pagination, ...config.pagination, page: 1 },
      activePreset: preset,
    });
    
    // ✅ REMOVED: Auto-fetch eliminado
    // get().fetchEvents(true);
  },
  
  syncFromURL: (params) => {
    const parsed = parseSearchParams(params);
    
    const updates: Partial<EventsStore> = {};
    
    if (parsed.filters && Object.keys(parsed.filters).length > 0) {
      updates.filters = { ...get().filters, ...parsed.filters };
    }
    
    if (parsed.sort && parsed.sort.length > 0) {
      updates.sort = parsed.sort;
    }
    
    if (parsed.pagination) {
      updates.pagination = { ...get().pagination, ...parsed.pagination };
    }
    
    if (Object.keys(updates).length > 0) {
      set(updates);
      // ✅ REMOVED: Auto-fetch eliminado - componente debe llamar fetchEvents() después de syncFromURL()
      // get().fetchEvents(true);
    }
  },
  
  getURLParams: () => {
    const { filters, sort, pagination } = get();
    
    return serializeToSearchParams({
      filters,
      sort,
      pagination: { page: pagination.page, pageSize: pagination.pageSize },
    });
  },
  
  selectEvent: (event) => {
    set({ selectedEvent: event });
  },
  
  clearErrors: () => {
    set({
      errors: {
        events: null,
        create: null,
        update: null,
        delete: null,
        stats: null,
      },
    });
  },
  
  reset: () => {
    set(initialState);
  },
});

// ==================== CREAR STORE ====================

export const useEventsStore = create<EventsStore>()(
  devtools(createEventsStore, { name: 'EventsStore' })
);
