/**
 * ===================================================================
 * SDK DE COMENTARIOS - API DE ALTO NIVEL
 * ===================================================================
 * Proporciona funciones de alto nivel para gestionar comentarios.
 * Integra httpClient + adaptadores + manejo de errores.
 * ===================================================================
 */

import { httpClient } from './client';
import { ENDPOINTS } from './client/config';
import type { 
  BackendCommentDTO,
  BackendCommentsPage
} from './types/backend.types';
import type { PageResponse } from './types/pagination.types';
import {
  adaptCommentFromBackend,
  adaptCommentsPageFromBackend,
  adaptCommentForCreate,
  adaptCommentForUpdate,
  validateCommentBody,
} from './adapters';
import type {
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
} from './adapters/comment.adapter';

// Re-exportar tipos para que estén disponibles desde este módulo
export type { CreateCommentInput, UpdateCommentInput, Comment };

// ==================== TIPOS ESPECÍFICOS DEL SDK ====================

/**
 * Parámetros para obtener comentarios paginados
 */
export interface GetCommentsParams {
  page?: number;
  size?: number;
  sort?: 'ASC' | 'DESC';
}

/**
 * Resultado de validación de comentario
 */
export interface CommentValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Reacciones predefinidas para comentarios rápidos
 */
export type QuickReaction = '👍' | '❤️' | '🎉' | '🤔' | '👀' | '🚀';

// ==================== FUNCIONES DEL SDK ====================

/**
 * Obtiene los comentarios de un evento con paginación
 * 
 * @param eventId - ID del evento
 * @param params - Parámetros de paginación y filtros
 * @returns Página de comentarios adaptados
 * 
 * @example
 * const commentsPage = await commentsApi.getComments(123, {
 *   page: 0,
 *   size: 10
 * });
 * 
 * commentsPage.content.forEach(comment => {
 *   console.log(`${comment.author.fullName}: ${comment.body}`);
 * });
 */
export async function getComments(
  eventId: number,
  params: GetCommentsParams = {}
): Promise<PageResponse<Comment>> {
  const { page = 0, size = 10, sort } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    size: size.toString()
  });

  if (sort) {
    queryParams.append('sort', `createdAt,${sort.toLowerCase()}`);
  }

  // ✅ FIX: Usar ENDPOINTS.COMMENTS() que ya incluye el eventId
  const backendPage = await httpClient.get<BackendCommentsPage>(
    `${ENDPOINTS.COMMENTS(eventId)}?${queryParams.toString()}`
  );

  return adaptCommentsPageFromBackend(backendPage);
}

/**
 * Obtiene un comentario específico por su ID
 * 
 * @param eventId - ID del evento
 * @param commentId - ID del comentario
 * @returns Comentario adaptado
 * 
 * @throws {ApiError} Si el comentario no existe (404)
 * 
 * @example
 * const comment = await commentsApi.getCommentById(123, 456);
 * console.log(comment.body);
 */
export async function getCommentById(
  eventId: number,
  commentId: number
): Promise<Comment> {
  const backendComment = await httpClient.get<BackendCommentDTO>(
    ENDPOINTS.COMMENT_BY_ID(eventId, commentId)
  );

  return adaptCommentFromBackend(backendComment);
}

/**
 * Crea un nuevo comentario en un evento
 * Valida el contenido antes de enviar
 * 
 * @param eventId - ID del evento
 * @param input - Datos del comentario a crear
 * @returns Comentario creado y adaptado
 * 
 * @throws {Error} Si la validación falla
 * @throws {ApiError} Si hay errores del servidor (400, 403)
 * 
 * @example
 * const newComment = await commentsApi.createComment(123, {
 *   body: 'Este es un comentario importante'
 * });
 */
export async function createComment(
  eventId: number,
  input: CreateCommentInput
): Promise<Comment> {
  // 1. Validar contenido
  const validation = validateCommentBody(input.body);
  if (!validation.isValid) {
    throw new Error(validation.error!);
  }

  // 2. Adaptar a DTO del backend
  const createDTO = adaptCommentForCreate(input);

  // 3. Enviar al backend
  const createdComment = await httpClient.post<BackendCommentDTO>(
    ENDPOINTS.COMMENTS(eventId),
    createDTO
  );

  // 4. Adaptar respuesta
  return adaptCommentFromBackend(createdComment);
}

/**
 * Actualiza un comentario existente
 * Valida el contenido antes de enviar
 * 
 * @param eventId - ID del evento
 * @param commentId - ID del comentario a actualizar
 * @param input - Nuevos datos del comentario
 * @returns Comentario actualizado y adaptado
 * 
 * @throws {Error} Si la validación falla
 * @throws {ApiError} Si no tiene permisos (403) o no existe (404)
 * 
 * @example
 * const updated = await commentsApi.updateComment(123, 456, {
 *   body: 'Comentario actualizado'
 * });
 */
export async function updateComment(
  eventId: number,
  commentId: number,
  input: UpdateCommentInput
): Promise<Comment> {
  // 1. Validar contenido
  const validation = validateCommentBody(input.body);
  if (!validation.isValid) {
    throw new Error(validation.error!);
  }

  // 2. Adaptar a DTO del backend
  const updateDTO = adaptCommentForUpdate(input);

  // 3. Enviar al backend
  const updatedComment = await httpClient.patch<BackendCommentDTO>(
    ENDPOINTS.COMMENT_BY_ID(eventId, commentId),
    updateDTO
  );

  // 4. Adaptar respuesta
  return adaptCommentFromBackend(updatedComment);
}

/**
 * Elimina un comentario
 * 
 * @param eventId - ID del evento
 * @param commentId - ID del comentario a eliminar
 * 
 * @throws {ApiError} Si no tiene permisos (403) o no existe (404)
 * 
 * @example
 * await commentsApi.deleteComment(123, 456);
 */
export async function deleteComment(
  eventId: number,
  commentId: number
): Promise<void> {
  await httpClient.delete(
    ENDPOINTS.COMMENT_BY_ID(eventId, commentId)
  );
}

/**
 * Valida el contenido de un comentario sin enviarlo
 * Útil para validación en tiempo real en formularios
 * 
 * @param body - Texto del comentario
 * @returns Resultado de validación
 * 
 * @example
 * const validation = commentsApi.validateComment(userInput);
 * if (!validation.isValid) {
 *   setError(validation.error);
 * }
 */
export function validateComment(body: string): CommentValidationResult {
  return validateCommentBody(body);
}

/**
 * Obtiene todos los comentarios de un evento (sin paginación)
 * Útil para vistas que necesitan mostrar todos los comentarios
 * 
 * @param eventId - ID del evento
 * @returns Array de todos los comentarios
 * 
 * @example
 * const allComments = await commentsApi.getAllComments(123);
 */
export async function getAllComments(
  eventId: number
): Promise<Comment[]> {
  const queryParams = new URLSearchParams({
    page: '0',
    size: '1000' // Tamaño grande para obtener todos
  });

  const backendPage = await httpClient.get<BackendCommentsPage>(
    `${ENDPOINTS.COMMENTS(eventId)}?${queryParams.toString()}`
  );

  const adaptedPage = adaptCommentsPageFromBackend(backendPage);
  return adaptedPage.content;
}

/**
 * Obtiene el conteo de comentarios de un evento
 * 
 * @param eventId - ID del evento
 * @returns Número total de comentarios
 * 
 * @example
 * const count = await commentsApi.getCommentsCount(123);
 * console.log(`Total comentarios: ${count}`);
 */
export async function getCommentsCount(
  eventId: number
): Promise<number> {
  const queryParams = new URLSearchParams({
    page: '0',
    size: '1'
  });

  const backendPage = await httpClient.get<BackendCommentsPage>(
    `${ENDPOINTS.COMMENTS(eventId)}?${queryParams.toString()}`
  );

  if (typeof backendPage.page === 'object') {
    return backendPage.page.totalElements;
  }

  return backendPage.total ?? 0;
}

/**
 * Obtiene los comentarios internos de un evento
 * Shortcut para obtener los comentarios internos del endpoint de comentarios
 * 
 * @param eventId - ID del evento
 * @param params - Parámetros de paginación
 * @returns Página de comentarios internos
 * 
 * @example
 * const internalComments = await commentsApi.getInternalComments(123, {
 *   page: 0,
 *   size: 20
 * });
 */
export async function getInternalComments(
  eventId: number,
  params: GetCommentsParams = {}
): Promise<PageResponse<Comment>> {
  return getComments(eventId, params);
}

/**
 * Agregar reacción rápida (comentario predefinido)
 * 
 * @param eventId - ID del evento
 * @param reaction - Tipo de reacción
 * @returns Comentario creado
 * 
 * @example
 * await commentsApi.addQuickReaction(123, 'approved');
 */
export async function addQuickReaction(
  eventId: number,
  reaction: 'approved' | 'needs_revision' | 'rejected'
): Promise<Comment> {
  const reactionTexts = {
    approved: '✅ Aprobado',
    needs_revision: '⚠️ Requiere revisión',
    rejected: '❌ Rechazado'
  };

  return createComment(eventId, {
    body: reactionTexts[reaction]
  });
}

// ==================== EXPORT DEFAULT ====================

/**
 * API de Comentarios - Objeto con todas las funciones
 * Permite importar como: import { commentsApi } from '@/services/api'
 */
export const commentsApi = {
  getComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
  validateComment,
  getAllComments,
  getCommentsCount,
  getInternalComments,
  addQuickReaction
};

// Export individual de funciones para tree-shaking
export default commentsApi;
