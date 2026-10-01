/**
 * ===================================================================
 * UTILIDADES PARA GESTIÓN DE APROBACIONES
 * ===================================================================
 * Helpers y componentes para el flujo de doble conformidad
 * (Ceremonial + Técnica)
 * ===================================================================
 */

import { Badge } from '@/components/ui/badge';
import type { TechSupportMode } from '@/models/event';
import type { AuditEntry } from '@/services/api/adapters';

export type ApprovalType = 'ceremonial' | 'technical';

/**
 * Convierte los códigos de backend de aprobaciones faltantes a etiquetas españolas
 * 
 * @param missing - Array de códigos del backend (ej: ['ceremonial_ok', 'technical_ok'])
 * @returns String formateado para mostrar al usuario
 * 
 * @example
 * formatMissingApprovals(['ceremonial_ok']) // "Ceremonial"
 * formatMissingApprovals(['technical_ok']) // "Técnica"
 * formatMissingApprovals(['ceremonial_ok', 'technical_ok']) // "Ceremonial, Técnica"
 * formatMissingApprovals([]) // ""
 */
export function formatMissingApprovals(missing: string[]): string {
  if (!missing || missing.length === 0) {
    return '';
  }

  const labels = missing.map((code) => {
    switch (code) {
      case 'ceremonial_ok':
        return 'Ceremonial';
      case 'technical_ok':
        return 'Técnica';
      default:
        // Fallback: capitalizar y reemplazar guiones bajos
        return code.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
  });

  return labels.join(', ');
}

/**
 * Obtiene etiqueta legible del modo de soporte técnico
 * 
 * @param mode - Modo de soporte técnico desde el backend
 * @returns String formateado para UI
 * 
 * @example
 * getTechSupportModeLabel('SETUP_ONLY') // "Solo montaje"
 * getTechSupportModeLabel('ATTENDED') // "Acompañamiento completo"
 * getTechSupportModeLabel(null) // "No especificado"
 */
export function getTechSupportModeLabel(mode: TechSupportMode | null): string {
  if (!mode) {
    return 'No especificado';
  }

  switch (mode) {
    case 'SETUP_ONLY':
      return 'Solo montaje';
    case 'ATTENDED':
      return 'Acompañamiento completo';
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = mode;
      return String(_exhaustive);
  }
}

/**
 * Props del componente ApprovalBadge
 */
interface ApprovalBadgeProps {
  /** Tipo de aprobación (ceremonial o técnica) */
  type: 'ceremonial' | 'technical';
  /** Si la aprobación fue otorgada */
  approved: boolean;
  /** Clase CSS adicional */
  className?: string;
}

/**
 * Badge visual que indica el estado de una aprobación (Ceremonial o Técnica)
 * 
 * @example
 * <ApprovalBadge type="ceremonial" approved={true} />
 * // Muestra: ✅ Ceremonial Aprobada
 * 
 * <ApprovalBadge type="technical" approved={false} />
 * // Muestra: ⏳ Técnica Pendiente
 */
export function ApprovalBadge({ type, approved, className = '' }: ApprovalBadgeProps) {
  const label = type === 'ceremonial' ? 'Ceremonial' : 'Técnica';
  const icon = approved ? '✅' : '⏳';
  const status = approved ? 'Aprobada' : 'Pendiente';
  const variant = approved ? 'default' : 'outline';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant={variant} className="text-sm">
        {icon} {label} {status}
      </Badge>
    </div>
  );
}

export function isApprovalAuditEntry(entry: AuditEntry): boolean {
  return entry.actionType === 'FIELD_UPDATE'
    && (entry.field === 'ceremonial_ok' || entry.field === 'technical_ok');
}

export function getApprovalTypeFromEntry(entry: AuditEntry): ApprovalType | null {
  if (entry.field === 'ceremonial_ok') {
    return 'ceremonial';
  }

  if (entry.field === 'technical_ok') {
    return 'technical';
  }

  return null;
}

export function getApprovalTypeLabel(type: ApprovalType): string {
  return type === 'ceremonial' ? 'Ceremonial' : 'Técnica';
}

export function getApprovalDecisionLabel(entry: AuditEntry): string {
  return entry.toValue === 'true' ? 'Aprobó' : 'Revocó';
}

/**
 * Formatea un rango de buffers para mostrar en UI
 * 
 * @param bufferBefore - Minutos de buffer antes del evento
 * @param bufferAfter - Minutos de buffer después del evento
 * @returns String formateado o null si ambos son 0
 * 
 * @example
 * formatBuffers(30, 15) // "Buffer: 30m antes / 15m después"
 * formatBuffers(0, 0) // null
 * formatBuffers(15, 0) // "Buffer: 15m antes"
 */
export function formatBuffers(bufferBefore: number, bufferAfter: number): string | null {
  if (bufferBefore === 0 && bufferAfter === 0) {
    return null;
  }

  const parts: string[] = [];
  
  if (bufferBefore > 0) {
    parts.push(`${bufferBefore}m antes`);
  }
  
  if (bufferAfter > 0) {
    parts.push(`${bufferAfter}m después`);
  }

  return `Buffer: ${parts.join(' / ')}`;
}

/**
 * Obtiene el mensaje descriptivo para el estado de aprobaciones
 * 
 * @param ceremonialOk - Si la aprobación ceremonial fue otorgada
 * @param technicalOk - Si la aprobación técnica fue otorgada
 * @returns Mensaje descriptivo del estado
 * 
 * @example
 * getApprovalStatusMessage(true, true) // "Listo para aprobación definitiva"
 * getApprovalStatusMessage(true, false) // "Para aprobar definitivamente falta: Técnica"
 * getApprovalStatusMessage(false, true) // "Para aprobar definitivamente falta: Ceremonial"
 * getApprovalStatusMessage(false, false) // "Para aprobar definitivamente faltan: Ceremonial, Técnica"
 */
export function getApprovalStatusMessage(
  ceremonialOk: boolean,
  technicalOk: boolean
): string {
  if (ceremonialOk && technicalOk) {
    return 'Listo para aprobación definitiva';
  }

  const missing: string[] = [];
  if (!ceremonialOk) missing.push('Ceremonial');
  if (!technicalOk) missing.push('Técnica');

  if (missing.length === 1) {
    return `Para aprobar definitivamente falta: ${missing[0]}`;
  }

  return `Para aprobar definitivamente faltan: ${missing.join(', ')}`;
}
