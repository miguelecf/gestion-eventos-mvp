/**
 * Barrel export para cliente HTTP
 * Facilita imports: import { httpClient, ENDPOINTS } from '@/services/api/client'
 */

export { httpClient } from './httpClient';
export { API_CONFIG, ENDPOINTS, ERROR_CODES } from './config';
export type { ErrorCode } from './config';
export { 
  authInterceptor, 
  createErrorInterceptor,
  errorInterceptor,
  requestLoggingInterceptor,
  responseLoggingInterceptor
} from './interceptors';
