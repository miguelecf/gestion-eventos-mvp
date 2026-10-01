import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

// ===================================================================
// ✅ TIPOS Y HELPERS DE TOKENS
// ===================================================================

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

/**
 * ✅ Obtener tokens del localStorage
 * Busca: 'accessToken' y 'refreshToken' como keys independientes
 */
export function getStoredTokens(): Tokens | null {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!accessToken || !refreshToken) {
    return null;
  }
  
  return { accessToken, refreshToken };
}

/**
 * ✅ Guardar tokens en localStorage
 * Guarda: 'accessToken' y 'refreshToken' como keys independientes
 */
export function setStoredTokens(tokens: Tokens | null): void {
  if (!tokens) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return;
  }
  
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
}

/**
 * ✅ Limpiar todos los tokens
 */
export function clearStoredTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// ===================================================================
// ✅ CLIENTE HTTP CON INTERCEPTORES
// ===================================================================

export const httpClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// ===================================================================
// 📤 REQUEST INTERCEPTOR: Agregar token automáticamente
// ===================================================================

httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = localStorage.getItem('accessToken');
    
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // 🔍 DEV: Logging
    if (import.meta.env.DEV) {
      console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`, {
        hasToken: !!accessToken,
        token: accessToken ? `${accessToken.substring(0, 20)}...` : 'none'
      });
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Error en request interceptor:', error);
    return Promise.reject(error);
  }
);

// ===================================================================
// 📥 RESPONSE INTERCEPTOR: Manejo de errores y refresh
// ===================================================================

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  
  failedQueue = [];
};

httpClient.interceptors.response.use(
  (response) => {
    // 🔍 DEV: Logging
    if (import.meta.env.DEV) {
      console.log(`📥 ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // ❌ Error de red
    if (!error.response) {
      console.error('❌ Error de red:', error.message);
      return Promise.reject({
        message: 'Error de conexión. Verifica tu red.',
        status: 0,
        code: 'NETWORK_ERROR'
      });
    }

    const { status } = error.response;

    // 🔍 DEV: Logging de errores
    if (import.meta.env.DEV) {
      console.group('❌ Error en Response');
      console.error('URL:', originalRequest.url);
      console.error('Status:', status);
      console.error('Message:', error.response?.data?.message || error.message);
      console.groupEnd();
    }

    // ===================================================================
    // 🔄 401: Token expirado - Intentar refresh
    // ===================================================================
    if (status === 401 && !originalRequest._retry) {
      // No intentar refresh en endpoints de auth
      const isAuthEndpoint = 
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/register') ||
        originalRequest.url?.includes('/auth/refresh');

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      // Si ya estamos refrescando, poner en cola
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return httpClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        console.error('❌ No hay refreshToken');
        clearStoredTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        console.log('🔄 Intentando renovar token...');

        // Hacer request de refresh sin interceptores
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          throw new Error('Refresh failed');
        }

        const data = await response.json();

        // ✅ Guardar nuevos tokens
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }

        console.log('✅ Token renovado exitosamente');

        // Procesar cola de requests pendientes
        processQueue(null, data.accessToken);

        // Actualizar header del request original
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

        return httpClient(originalRequest);
      } catch (refreshError) {
        console.error('❌ Error al renovar token:', refreshError);
        processQueue(refreshError, null);
        clearStoredTokens();
        window.location.href = '/login?sessionExpired=true';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ===================================================================
    // 🚫 403: Sin permisos
    // ===================================================================
    if (status === 403) {
      console.error('❌ Acceso denegado (403)');
      return Promise.reject({
        message: 'No tienes permisos para realizar esta acción',
        status: 403,
        code: 'FORBIDDEN'
      });
    }

    // ===================================================================
    // 🔍 404: No encontrado
    // ===================================================================
    if (status === 404) {
      return Promise.reject({
        message: error.response?.data?.message || 'Recurso no encontrado',
        status: 404,
        code: 'NOT_FOUND'
      });
    }

    // Error genérico
    return Promise.reject({
      message: error.response?.data?.message || error.message || 'Error desconocido',
      status,
      code: error.response?.data?.code || `HTTP_${status}`,
      details: error.response?.data?.details
    });
  }
);

export default httpClient;
