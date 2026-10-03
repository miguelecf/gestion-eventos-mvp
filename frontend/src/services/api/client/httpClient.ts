import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_CONFIG, DEV_AUTH_TOKEN, hasDevToken } from './config';
import { 
  authInterceptor, 
  createErrorInterceptor,
  requestLoggingInterceptor,
  responseLoggingInterceptor
} from './interceptors';

/**
 * Cliente HTTP centralizado basado en Axios
 * Incluye interceptores para autenticación, logging y manejo de errores
 */
class HttpClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create(API_CONFIG);
    this.setupDevToken();
    this.setupInterceptors();
  }

  /**
   * ===================================================================
   * 🛠️ DEV: AUTO-CONFIGURAR TOKEN HARDCODEADO
   * ===================================================================
   * ⚠️ REMOVER ANTES DE PRODUCCIÓN
   * 
   * Configuración automática de token para desarrollo.
   * Se ejecuta solo si:
   * - Estamos en modo desarrollo (import.meta.env.DEV)
   * - DEV_AUTH_TOKEN tiene un valor no vacío
   * ===================================================================
   */
  private setupDevToken(): void {
    if (hasDevToken()) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${DEV_AUTH_TOKEN}`;
      
      // Logging visual para desarrollo
      console.group('🛠️ DEV: Configuración de Autenticación');
      console.warn('⚠️ Token hardcodeado configurado automáticamente');
      console.log('📍 Modo:', import.meta.env.MODE);
      console.log('🔑 Token (primeros 20 chars):', DEV_AUTH_TOKEN.substring(0, 20) + '...');
      console.warn('⚠️ REMOVER antes de producción');
      console.groupEnd();
    }
  }

  /**
   * Configura interceptores de request y response
   */
  private setupInterceptors(): void {
    // Request interceptors
    this.client.interceptors.request.use(
      authInterceptor,
      (error) => Promise.reject(error)
    );

    // Logging en desarrollo
    if (import.meta.env.DEV) {
      this.client.interceptors.request.use(
        requestLoggingInterceptor,
        (error) => Promise.reject(error)
      );
    }

    // Response interceptors
    if (import.meta.env.DEV) {
      this.client.interceptors.response.use(
        responseLoggingInterceptor,
        (error) => Promise.reject(error)
      );
    }

    this.client.interceptors.response.use(
      (response) => response,
      createErrorInterceptor(this.client)
    );
  }

  /**
   * Retorna la instancia de Axios para casos especiales
   */
  getInstance(): AxiosInstance {
    return this.client;
  }

  /**
   * GET request tipado
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * POST request tipado
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * PUT request tipado
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * PATCH request tipado
   */
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * DELETE request tipado
   */
  async delete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * Request genérico para casos especiales
   */
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  /**
   * Actualiza el token de autenticación dinámicamente
   */
  setAuthToken(token: string | null): void {
    if (token) {
      localStorage.setItem('accessToken', token);
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('✅ Token de autenticación establecido');
    } else {
      localStorage.removeItem('accessToken');
      delete this.client.defaults.headers.common['Authorization'];
      console.log('🗑️ Token de autenticación removido');
    }
  }

  /**
   * Obtener token actual (desde localStorage o headers)
   * 
   * @returns Token actual o null si no existe
   */
  getAuthToken(): string | null {
    // Primero intentar desde headers
    const headerToken = this.client.defaults.headers.common['Authorization'];
    if (headerToken && typeof headerToken === 'string') {
      return headerToken.replace('Bearer ', '');
    }
    
    // Luego desde localStorage
    return localStorage.getItem('accessToken');
  }

  /**
   * Verificar si hay un token configurado
   * 
   * @returns true si hay token (hardcodeado, en headers o localStorage)
   */
  hasAuthToken(): boolean {
    return hasDevToken() || this.getAuthToken() !== null;
  }
}

// Instancia singleton del cliente HTTP
export const httpClient = new HttpClient();

// Export por defecto de la instancia de Axios para casos edge
export default httpClient.getInstance();
