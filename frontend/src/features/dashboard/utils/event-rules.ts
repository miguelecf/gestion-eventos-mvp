/**
 * ===================================================================
 * EVENT RULES - LÓGICA DE NEGOCIO CENTRALIZADA
 * ===================================================================
 * Helpers para encapsular reglas de validación y cálculo de estados
 * de eventos. Evita duplicar lógica en múltiples componentes.
 * ===================================================================
 */

import type { Event } from '@/models/event';
import { EventStatus } from '@/services/api/types/backend.types';

export const eventRules = {
  /**
   * Determina si un evento requiere reprogramación
   */
  requiresRebooking: (event: Event): boolean => {
    return event.requiresRebooking;
  },

  /**
   * Determina si falta alguna conformidad requerida para un evento
   * Ignora eventos en estado RECHAZADO
   */
  isMissingConformity: (event: Event): boolean => {
    // Ignorar si está rechazado
    if (event.status === EventStatus.RECHAZADO) {
      return false;
    }

    // Falta conformidad de Ceremonial
    if (!event.ceremonialOk) return true;

    // Falta conformidad de Técnica (solo si requiere técnica)
    if (event.requiresTech && !event.technicalOk) return true;

    return false;
  },

  /**
   * Determina la severidad de alerta para un evento
   */
  getAlertSeverity: (event: Event): 'high' | 'medium' | 'low' => {
    if (event.requiresRebooking) return 'high';
    if (eventRules.isMissingConformity(event)) return 'medium';
    return 'low';
  },

  /**
   * Verifica si un evento está aprobado y confirmado
   */
  isFullyApproved: (event: Event): boolean => {
    return (
      event.status === EventStatus.APROBADO &&
      event.ceremonialOk &&
      (!event.requiresTech || event.technicalOk)
    );
  },

  /**
   * Verifica si un evento necesita atención urgente
   */
  needsUrgentAttention: (event: Event): boolean => {
    return (
      event.requiresRebooking ||
      (event.status === EventStatus.EN_REVISION && eventRules.isMissingConformity(event))
    );
  },
};
