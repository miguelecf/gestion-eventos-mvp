import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_CONFIG } from './config';
import type { ApiError } from '../types/api.types';

type BackendErrorPayload = {
  message?: string;
  code?: string;
  error?: string;
  timestamp?: string;
  isAvailable?: boolean;
  conflicts?: unknown;
} & Record<string, unknown>;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toBackendErrorPayload = (value: unknown): BackendErrorPayload | null =>
  isObjectRecord(value) ? (value as BackendErrorPayload) : null;

/**
 * Interceptor de autenticación
 * Agrega el token JWT a todas las requests autenticadas
 * ✅ SINCRONIZADO: Lee 'accessToken' de localStorage
 */
export const authInterceptor = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  // ✅ Leer 'accessToken' (key consistente)
  const token = localStorage.getItem('accessToken');
  
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
};

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type RefreshResponse = {
  accessToken?: unknown;
  refreshToken?: unknown;
};

const clearStoredTokens = (): void => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

const normalizeError = (error: AxiosError): ApiError => {
  // Error de red (sin respuesta del servidor)
  if (!error.response) {
    return {
      message: error.message || 'Error de conexión. Verifica tu red.',
      status: 0,
      code: error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR',
      timestamp: new Date().toISOString()
    };
  }

  // Error HTTP con respuesta del servidor
  const { status, data } = error.response;
  const payload = toBackendErrorPayload(data);
  
  // Construir ApiError desde respuesta del backend
  const apiError: ApiError = {
    message: payload?.message || error.message || 'Error desconocido',
    status,
    code: payload?.code || payload?.error || payload?.message || `HTTP_${status}`,
    details: isObjectRecord(data) ? data : undefined,
    timestamp: payload?.timestamp || new Date().toISOString()
  };

  // Manejo especial de 403 (sin permisos)
  if (status === 403) {
    apiError.message = 'No tienes permisos para realizar esta acción';
  }

  // Manejo especial de 404
  if (status === 404) {
    apiError.message = payload?.message || 'El recurso solicitado no existe';
  }

  // Manejo especial de 409 (conflicto)
  if (status === 409) {
    apiError.message = payload?.message || 'Ya existe un recurso con los mismos datos';
    
    // ⚠️ IMPORTANTE: Preservar datos originales del backend para conflictos de disponibilidad
    // Si el backend retorna AvailabilityConflictResponse (con isAvailable, conflicts, etc.),
    // lo agregamos al ApiError para que pueda ser extraído posteriormente
    if (payload?.isAvailable !== undefined && payload.conflicts !== undefined) {
      apiError.details = data as Record<string, any>;
    }
  }

  return apiError;
};

/**
 * Interceptor de errores
 * Renueva una sesión expirada una sola vez, compartiendo la renovación entre
 * requests concurrentes, y normaliza los errores que no se puedan recuperar.
 */
export const createErrorInterceptor = (client: AxiosInstance) => {
  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
  }> = [];

  const processQueue = (error: unknown, token: string | null = null): void => {
    failedQueue.forEach((pending) => {
      if (error) pending.reject(error);
      else if (token) pending.resolve(token);
    });
    failedQueue = [];
  };

  const refreshSession = async (): Promise<string> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No hay refreshToken');
    }

    const response = await fetch(`${API_CONFIG.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) throw new Error('Refresh failed');

    const data = await response.json() as RefreshResponse;
    if (typeof data.accessToken !== 'string' || data.accessToken.length === 0) {
      throw new Error('Refresh response did not include an accessToken');
    }

    localStorage.setItem('accessToken', data.accessToken);
    if (typeof data.refreshToken === 'string' && data.refreshToken.length > 0) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    return data.accessToken;
  };

  return async (error: AxiosError): Promise<never> => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const requestUrl = originalRequest?.url ?? '';
    const isAuthEndpoint = ['/auth/login', '/auth/register', '/auth/refresh']
      .some((endpoint) => requestUrl.includes(endpoint));

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      // Mark before queueing too: a replayed request must never start another refresh.
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(client(originalRequest));
            },
            reject,
          });
        }) as Promise<never>;
      }

      isRefreshing = true;
      const hadRefreshToken = Boolean(localStorage.getItem('refreshToken'));
      let accessToken: string;
      try {
        accessToken = await refreshSession();
      } catch (refreshError) {
        processQueue(refreshError);
        clearStoredTokens();
        window.location.href = hadRefreshToken ? '/login?sessionExpired=true' : '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }

      processQueue(null, accessToken);
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      // Do not await inside the refresh try/catch: a replayed 401 is not a
      // refresh failure and must not clear a freshly renewed session.
      return client(originalRequest) as Promise<never>;
    }

    throw normalizeError(error);
  };
};

/** Standalone normalizer retained for consumers that use this interceptor directly. */
export const errorInterceptor = async (error: AxiosError): Promise<never> => {
  return Promise.reject(normalizeError(error));
};

/**
 * Interceptor de requests para logging (solo en desarrollo)
 */
export const requestLoggingInterceptor = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  if (import.meta.env.DEV) {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
      params: config.params,
      data: config.data
    });
  }
  return config;
};

/**
 * Interceptor de responses para logging (solo en desarrollo)
 */
export const responseLoggingInterceptor = (
  response: AxiosResponse<unknown>
): AxiosResponse<unknown> => {
  if (import.meta.env.DEV) {
    console.log(`[API Response] ${response.status} ${response.config.url}`, {
      data: response.data
    });
  }
  return response;
};
