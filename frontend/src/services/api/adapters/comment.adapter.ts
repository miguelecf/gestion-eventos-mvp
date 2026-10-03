/**
 * ===================================================================
 * ADAPTADOR DE COMENTARIOS
 * ===================================================================
 * Transforma BackendCommentDTO <-> Comment (modelo del frontend)
 * Acepta tanto el contrato actual del backend como el contrato legacy.
 * ===================================================================
 */

import type {
  BackendCommentDTO,
  BackendCreateCommentDTO,
  BackendUpdateCommentDTO,
  BackendCommentsPage,
  CommentVisibility,
} from '../types/backend.types';
import type { PageResponse } from '../types/pagination.types';

export interface Comment {
  id: number;
  body: string;
  visibility: CommentVisibility;
  author: {
    id: number;
    fullName: string;
    username: string | null;
  };
  editedBy: {
    id: number;
    fullName: string;
  } | null;
  createdAt: Date;
  updatedAt: Date | null;
  isEdited: boolean;
}

export interface CreateCommentInput {
  body: string;
}

export interface UpdateCommentInput {
  body: string;
}

function normalizeAuthor(backendComment: BackendCommentDTO): Comment['author'] {
  const legacyFullName = `${backendComment.authorName ?? ''} ${backendComment.authorLastName ?? ''}`.trim();
  const currentName = backendComment.author?.name?.trim();

  return {
    id: backendComment.author?.id ?? backendComment.authorId ?? 0,
    fullName: currentName || legacyFullName || 'Usuario desconocido',
    username: backendComment.authorUsername ?? null,
  };
}

function normalizeEditedBy(
  backendComment: BackendCommentDTO
): Comment['editedBy'] {
  if (!backendComment.editedBy) {
    return null;
  }

  return {
    id: backendComment.editedBy.id,
    fullName: backendComment.editedBy.name,
  };
}

function normalizePage(
  backendPage: BackendCommentsPage,
  itemCount: number
): PageResponse<Comment>['page'] {
  if (typeof backendPage.page === 'object') {
    return backendPage.page;
  }

  const pageNumber = backendPage.page;
  const size = backendPage.size ?? itemCount;
  const totalElements = backendPage.total ?? itemCount;
  const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;

  return {
    number: pageNumber,
    size,
    totalElements,
    totalPages,
  };
}

export function adaptCommentFromBackend(backendComment: BackendCommentDTO): Comment {
  const createdAt = new Date(backendComment.createdAt);
  const updatedAt = backendComment.updatedAt ? new Date(backendComment.updatedAt) : null;

  return {
    id: backendComment.id,
    body: backendComment.body,
    visibility: backendComment.visibility,
    author: normalizeAuthor(backendComment),
    editedBy: normalizeEditedBy(backendComment),
    createdAt,
    updatedAt,
    isEdited: updatedAt !== null && updatedAt.getTime() !== createdAt.getTime(),
  };
}

export function adaptCommentsFromBackend(backendComments: BackendCommentDTO[]): Comment[] {
  return backendComments.map(adaptCommentFromBackend);
}

export function adaptCommentsPageFromBackend(
  backendPage: BackendCommentsPage
): PageResponse<Comment> {
  const rawItems = backendPage.items ?? backendPage.comments ?? [];
  const content = adaptCommentsFromBackend(rawItems);
  const page = normalizePage(backendPage, rawItems.length);

  return {
    content,
    page,
    first: page.number === 0,
    last: page.totalPages === 0 || page.number >= page.totalPages - 1,
    empty: content.length === 0,
  };
}

export function adaptCommentForCreate(input: CreateCommentInput): BackendCreateCommentDTO {
  return {
    body: input.body.trim(),
  };
}

export function adaptCommentForUpdate(input: UpdateCommentInput): BackendUpdateCommentDTO {
  return {
    body: input.body.trim(),
  };
}

export function canEditComment(comment: Comment, currentUserId: number): boolean {
  return comment.author.id === currentUserId;
}

export function canDeleteComment(
  comment: Comment,
  currentUserId: number,
  isPrivileged: boolean
): boolean {
  return comment.author.id === currentUserId || isPrivileged;
}

export function getCommentAge(comment: Comment): string {
  const now = new Date();
  const diffMs = now.getTime() - comment.createdAt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;

  return comment.createdAt.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getCommentVisibilityColor(visibility: CommentVisibility): string {
  const colorMap: Record<CommentVisibility, string> = {
    INTERNAL: 'bg-gray-100 text-gray-800',
  };

  return colorMap[visibility] || 'bg-gray-100 text-gray-800';
}

export function validateCommentBody(body: string): {
  isValid: boolean;
  error: string | null;
} {
  const trimmed = body.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'El comentario no puede estar vacío',
    };
  }

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'El comentario debe tener al menos 3 caracteres',
    };
  }

  if (trimmed.length > 2500) {
    return {
      isValid: false,
      error: 'El comentario no puede exceder 2500 caracteres',
    };
  }

  return {
    isValid: true,
    error: null,
  };
}
