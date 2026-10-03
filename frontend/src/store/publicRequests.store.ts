import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import { handleApiError, logError } from '@/services/api';
import {
  publicRequestsApi,
  type RequestConversionResult,
  type RequestConversionOptions,
} from '@/services/api/publicRequests.api';
import { getDefaultPublicRequestSort } from '@/utils/request-sorting';
import type {
  PaginationState,
  PublicEventRequest,
  PublicRequestFilters,
  PublicRequestsQueryParams,
  PublicRequestStatus,
} from '@/models/public-request';

export interface LoadingState {
  requests: boolean;
  detail: boolean;
  action: boolean;
}

export interface ErrorState {
  requests: string | null;
  detail: string | null;
  action: string | null;
}

export type FetchRequestsParams = PublicRequestsQueryParams;

export interface PublicRequestsStore {
  requests: PublicEventRequest[];
  selectedRequest: PublicEventRequest | null;
  filters: PublicRequestFilters;
  pagination: PaginationState;
  sort: string;
  loading: LoadingState;
  errors: ErrorState;
  lastFetch: number | null;
  fetchRequests: (params?: FetchRequestsParams) => Promise<void>;
  fetchRequestById: (id: number) => Promise<PublicEventRequest | null>;
  changeRequestStatus: (
    id: number,
    to: Extract<PublicRequestStatus, 'EN_REVISION' | 'RECHAZADO'>,
    reason?: string
  ) => Promise<PublicEventRequest | null>;
  convertRequestToEvent: (id: number, options?: RequestConversionOptions) => Promise<RequestConversionResult | null>;
  setFilters: (filters: Partial<PublicRequestFilters>) => void;
  setPagination: (pagination: Partial<Pick<PaginationState, 'page' | 'pageSize'>>) => void;
  setSort: (sort: string) => void;
  clearSelectedRequest: () => void;
  clearErrors: () => void;
  reset: () => void;
}

const initialFilters: PublicRequestFilters = {
  search: '',
  status: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  startDate: undefined,
  endDate: undefined,
};

const initialPagination: PaginationState = {
  page: 0,
  pageSize: 20,
  totalElements: 0,
  totalPages: 0,
};

const initialLoading: LoadingState = {
  requests: false,
  detail: false,
  action: false,
};

const initialErrors: ErrorState = {
  requests: null,
  detail: null,
  action: null,
};

const initialState = {
  requests: [],
  selectedRequest: null,
  filters: initialFilters,
  pagination: initialPagination,
  sort: getDefaultPublicRequestSort(),
  loading: initialLoading,
  errors: initialErrors,
  lastFetch: null,
};

const createPublicRequestsStore: StateCreator<PublicRequestsStore> = (set, get) => ({
  ...initialState,

  fetchRequests: async (params) => {
    const currentFilters = get().filters;
    const currentPagination = get().pagination;
    const nextSearch =
      params?.search !== undefined ? params.search : currentFilters.search || '';
    const nextStatus =
      params?.status !== undefined ? params.status : currentFilters.status;
    const nextDateFrom =
      params?.dateFrom !== undefined
        ? params.dateFrom
        : currentFilters.dateFrom ?? currentFilters.startDate;
    const nextDateTo =
      params?.dateTo !== undefined
        ? params.dateTo
        : currentFilters.dateTo ?? currentFilters.endDate;
    const nextPage = params?.page ?? currentPagination.page;
    const nextPageSize = params?.size ?? currentPagination.pageSize;
    const nextSort = params?.sort ?? get().sort;

    if (params) {
      set((state) => ({
        filters: {
          ...state.filters,
          ...(params.search !== undefined ? { search: params.search } : {}),
          ...(params.status !== undefined ? { status: params.status } : {}),
          ...(params.dateFrom !== undefined || params.startDate !== undefined
            ? {
                dateFrom: params.dateFrom ?? params.startDate,
                startDate: params.startDate ?? params.dateFrom,
              }
            : {}),
          ...(params.dateTo !== undefined || params.endDate !== undefined
            ? {
                dateTo: params.dateTo ?? params.endDate,
                endDate: params.endDate ?? params.dateTo,
              }
            : {}),
        },
        pagination: {
          ...state.pagination,
          ...(params.page !== undefined ? { page: params.page } : {}),
          ...(params.size !== undefined ? { pageSize: params.size } : {}),
        },
        ...(params.sort !== undefined ? { sort: params.sort } : {}),
      }));
    }

    set((state) => ({
      loading: { ...state.loading, requests: true },
      errors: { ...state.errors, requests: null },
    }));

    try {
      const response = await publicRequestsApi.listAdminRequests({
        page: nextPage,
        size: nextPageSize,
        search: nextSearch || undefined,
        status: nextStatus,
        dateFrom: nextDateFrom,
        dateTo: nextDateTo,
        startDate: nextDateFrom,
        endDate: nextDateTo,
        sort: nextSort,
      });

      set((state) => ({
        requests: response.content,
        pagination: {
          ...state.pagination,
          page: response.page.number,
          pageSize: response.page.size,
          totalElements: response.page.totalElements,
          totalPages: response.page.totalPages,
        },
        sort: nextSort,
        lastFetch: Date.now(),
        loading: { ...state.loading, requests: false },
      }));
    } catch (error) {
      logError(error, 'PublicRequestsStore.fetchRequests');
      const apiError = handleApiError(error);

      set((state) => ({
        requests: [],
        loading: { ...state.loading, requests: false },
        errors: { ...state.errors, requests: apiError.message },
      }));
    }
  },

  fetchRequestById: async (id) => {
    set((state) => ({
      loading: { ...state.loading, detail: true },
      errors: { ...state.errors, detail: null },
    }));

    try {
      const request = await publicRequestsApi.getAdminRequestById(id);

      set((state) => ({
        selectedRequest: request,
        loading: { ...state.loading, detail: false },
      }));

      return request;
    } catch (error) {
      logError(error, 'PublicRequestsStore.fetchRequestById');
      const apiError = handleApiError(error);

      set((state) => ({
        selectedRequest: null,
        loading: { ...state.loading, detail: false },
        errors: { ...state.errors, detail: apiError.message },
      }));

      return null;
    }
  },

  changeRequestStatus: async (id, to, reason) => {
    set((state) => ({
      loading: { ...state.loading, action: true },
      errors: { ...state.errors, action: null },
    }));

    try {
      const updatedRequest = await publicRequestsApi.changeAdminRequestStatus(id, {
        newStatus: to,
        ...(reason ? { reason } : {}),
      });

      set((state) => ({
        selectedRequest: updatedRequest,
        requests: state.requests.map((request) => (
          request.id === id ? updatedRequest : request
        )),
        loading: { ...state.loading, action: false },
      }));

      return updatedRequest;
    } catch (error) {
      logError(error, 'PublicRequestsStore.changeRequestStatus');
      const apiError = handleApiError(error);

      set((state) => ({
        loading: { ...state.loading, action: false },
        errors: { ...state.errors, action: apiError.message },
      }));

      return null;
    }
  },

  convertRequestToEvent: async (id, options) => {
    set((state) => ({
      loading: { ...state.loading, action: true },
      errors: { ...state.errors, action: null },
    }));

    try {
      const result = await publicRequestsApi.convertAdminRequestToEvent(id, options);

      set((state) => ({
        selectedRequest: state.selectedRequest?.id === id
          ? {
              ...state.selectedRequest,
              status: 'CONVERTIDO',
              convertedEventId: result.eventId,
            }
          : state.selectedRequest,
        requests: state.requests.map((request) => (
          request.id === id
            ? { ...request, status: 'CONVERTIDO', convertedEventId: result.eventId }
            : request
        )),
        loading: { ...state.loading, action: false },
      }));

      return result;
    } catch (error) {
      logError(error, 'PublicRequestsStore.convertRequestToEvent');
      const apiError = handleApiError(error);

      set((state) => ({
        loading: { ...state.loading, action: false },
        errors: { ...state.errors, action: apiError.message },
      }));

      return null;
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 0 },
    }));
  },

  setPagination: (pagination) => {
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    }));
  },

  setSort: (sort) => {
    set((state) => ({
      sort,
      pagination: { ...state.pagination, page: 0 },
    }));
  },

  clearSelectedRequest: () => {
    set({ selectedRequest: null });
  },

  clearErrors: () => {
    set({ errors: initialErrors });
  },

  reset: () => {
    set(initialState);
  },
});

export const usePublicRequestsStore = create<PublicRequestsStore>()(
  devtools(createPublicRequestsStore, { name: 'PublicRequestsStore' })
);
