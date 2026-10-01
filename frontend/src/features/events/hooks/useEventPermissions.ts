import { useMemo } from 'react';
import { useAppStore } from '@/store';
import { useCan } from '@/hooks/useCan';
import type { Event } from '@/models/event';
import type { Comment } from '@/services/api/adapters/comment.adapter';

/**
 * Permisos de UI para un evento. Se derivan solo de CASL (`libs/ability.ts`),
 * que refleja docs/permisos.md: USUARIO solo lee; no edita, no da de baja,
 * no comenta ni ve auditoría (sin excepciones por ser creador).
 */
export function useEventPermissions(event: Event | null) {
  const can = useCan();
  const userId = useAppStore((state) => state.userId);

  return useMemo(() => {
    const isOwner = Boolean(event?.createdBy?.id != null && String(event.createdBy.id) === userId);

    const canReadPublicRequest = can('read', 'PublicRequest');
    const canUpdateEvent = can('update', 'Event');
    const canDeleteEvent = can('delete', 'Event');
    const canManageStatus = can('changeState', 'Event');
    const canApprove =
      can('approveCeremonial', 'Event') || can('approveTechnical', 'Event');
    const canViewTechCapacity = can('viewTechCapacity', 'TechCapacity');
    // Rol operativo = puede gestionar el circuito del evento (AF/AC/AT)
    const isOperativeRole = canManageStatus;

    const canViewAudit = can('audit:view', 'AuditLog');
    const canCreateComment = can('comment:create', 'Comment');
    const canViewComments = canCreateComment;
    const canEditAnyComment = can('comment:update', 'Comment');
    const canDeleteAnyComment = can('comment:delete', 'Comment');

    const canManageComment = (comment: Comment | null | undefined) => {
      if (!comment || !canViewComments) {
        return false;
      }

      const isOwnComment = String(comment.author.id) === userId;
      return isOwnComment || canDeleteAnyComment;
    };

    return {
      isOperativeRole,
      isOwner,
      canReadPublicRequest,
      canUpdateEvent,
      canDeleteEvent,
      canManageStatus,
      canApprove,
      canViewTechCapacity,
      canViewAudit,
      canViewComments,
      canCreateComment,
      canEditAnyComment,
      canDeleteAnyComment,
      canManageComment,
    };
  }, [can, event?.createdBy?.id, userId]);
}
