import { AbilityBuilder, createMongoAbility, type MongoAbility, type ForcedSubject } from '@casl/ability';
import matrix from './permisos.json';

// Acciones
const ACTIONS = [
  'manage', 'read', 'create', 'update', 'delete',
  'changeState',
  'approveCeremonial', 'approveTechnical',
  'resolvePriority',
  'viewTechCapacity',
  'manageCatalogs',
  'audit:view',
  'comment:create', 'comment:update', 'comment:delete',
  'request:create',
  'availability:check',
  'internal:toggle',
] as const;
export type Action = typeof ACTIONS[number];

// Sujetos
const SUBJECTS = [
  'Event',
  'EventRequest',
  'PublicRequest',
  'Comment',
  'Space',
  'Department',
  'Priority',
  'TechCapacity',
  'AuditLog',
  'Availability',
  'User',
  'all',
] as const;
export type Subject = typeof SUBJECTS[number];

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

interface PermissionRow {
  id: string;
  public?: boolean;
  roles?: string[];
  casl: { action: string; subject: string }[];
}

/**
 * Reglas CASL de la matriz única (permisos.json, SEC-04). Lo que no figura queda denegado.
 * Se validan al cargar el módulo: una acción o sujeto desconocido rompe al iniciar, no en silencio.
 */
const RULES = (matrix.permissions as PermissionRow[]).map((row) => ({
  public: row.public === true,
  roles: row.roles ?? [],
  casl: row.casl.map(({ action, subject }) => {
    if (!(ACTIONS as readonly string[]).includes(action) || !(SUBJECTS as readonly string[]).includes(subject)) {
      throw new Error(`permisos.json (${row.id}): acción o sujeto CASL desconocido: ${action} ${subject}`);
    }
    return { action: action as Action, subject: subject as Subject };
  }),
}));

export function defineAbilityFor(roles: string[], _userId: string): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  const userRoles = roles.map((role) => role.replace(/^ROLE_/, ''));

  for (const rule of RULES) {
    if (rule.public || rule.roles.some((role) => userRoles.includes(role))) {
      for (const { action, subject } of rule.casl) {
        can(action, subject);
      }
    }
  }

  return build();
}
