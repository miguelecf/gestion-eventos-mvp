import { AbilityBuilder, createMongoAbility, type MongoAbility, type ForcedSubject } from '@casl/ability';

// Acciones
export type Action = 
  | 'manage' | 'read' | 'create' | 'update' | 'delete'
  | 'changeState' 
  | 'approveCeremonial' | 'approveTechnical'
  | 'resolvePriority'
  | 'viewTechCapacity'
  | 'manageCatalogs'
  | 'audit:view'
  | 'comment:create' | 'comment:update' | 'comment:delete'
  | 'request:create'
  | 'availability:check'
  | 'internal:toggle';

// Sujetos
export type Subject = 
  | 'Event' 
  | 'EventRequest'
  | 'PublicRequest'
  | 'Comment' 
  | 'Space' 
  | 'Department' 
  | 'Priority' 
  | 'TechCapacity' 
  | 'AuditLog' 
  | 'Availability' 
  | 'all';

// Tipos para condiciones
export interface EventConditions {
  createdBy?: string;
  departmentId?: string;
  status?: string;
  internal?: boolean;
  requiresTech?: boolean;
}

export interface CommentConditions {
  authorId?: string;
  eventRequesterId?: string;
}

export interface AuditLogConditions {
  eventCreatedBy?: string;
  eventRequesterId?: string;
}

export type AppAbility = MongoAbility<[Action, Subject | ForcedSubject<Subject>]>;

export function defineAbilityFor(roles: string[], _userId: string): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // ROLE_ADMIN_FULL 👑
  if (roles.includes('ROLE_ADMIN_FULL')) {
    can('manage', 'all');
    return build();
  }

  // ROLE_ADMIN_CEREMONIAL 🎪
  if (roles.includes('ROLE_ADMIN_CEREMONIAL')) {
    can(['read', 'create', 'update', 'delete'], 'Event');
    can('changeState', 'Event');
    can('approveCeremonial', 'Event');
    can('internal:toggle', 'Event');
    can('read', 'Priority');
    can('resolvePriority', 'Priority');
    can('viewTechCapacity', 'TechCapacity');
    can(['comment:create', 'comment:update', 'comment:delete'], 'Comment');
    can('manageCatalogs', ['Space', 'Department']);
    can('audit:view', 'AuditLog');
    can('availability:check', 'Availability');
    can('request:create', 'EventRequest');
    can('read', ['Space', 'Department', 'PublicRequest']);
  }

  // ROLE_ADMIN_TECNICA 🔧
  if (roles.includes('ROLE_ADMIN_TECNICA')) {
    can(['read', 'create', 'update', 'delete'], 'Event');
    can('changeState', 'Event');
    can('approveTechnical', 'Event');
    can('internal:toggle', 'Event');
    can('read', 'Priority');
    can('viewTechCapacity', 'TechCapacity');
    can(['comment:create', 'comment:update', 'comment:delete'], 'Comment');
    can('manageCatalogs', ['Space', 'Department']);
    can('audit:view', 'AuditLog');
    can('availability:check', 'Availability');
    can('request:create', 'EventRequest');
    can('read', ['Space', 'Department', 'PublicRequest']);
    
    // Bloqueado: las decisiones de prioridad son solo AF/AC
    cannot('resolvePriority', 'Priority');
  }

  // ROLE_USUARIO 👤 (docs/permisos.md: ver eventos, pedir solicitudes, chequear disponibilidad, ver catálogos)
  if (roles.includes('ROLE_USUARIO')) {
    can('read', 'Event');
    can('request:create', 'EventRequest');
    can('availability:check', 'Availability');
    can('read', ['Space', 'Department']);

    // Bloqueado (explícito): no crea/edita/da de baja eventos, no ve la bandeja,
    // ni comentarios, auditoría, prioridad o capacidad técnica.
    cannot(['create', 'update', 'delete', 'changeState', 'internal:toggle'], 'Event');
    cannot('read', ['PublicRequest', 'Priority']);
    cannot(['manageCatalogs', 'resolvePriority', 'viewTechCapacity', 'audit:view', 'comment:create', 'comment:update', 'comment:delete'], 'all');
  }

  return build();
}

