import type { Event } from "../../models/event";
import { httpClient } from "./client";

/**
 * Obtiene todos los eventos activos
 */
export async function fetchEvents(): Promise<Event[]> {
  return httpClient.get<Event[]>("/api/events");
}

/**
 * Obtiene un evento por ID
 */
export async function fetchEventById(eventId: string): Promise<Event> {
  return httpClient.get<Event>(`/api/events/${eventId}`);
}

/**
 * Obtiene eventos de una fecha específica
 * @param date - Fecha en formato YYYY-MM-DD (ej: 2025-12-19)
 */
export async function fetchEventsByDate(date: string): Promise<Event[]> {
  return httpClient.get<Event[]>(`/api/events/date`, {
    params: { date }
  });
}

/**
 * Crea un nuevo evento
 */
export async function createEvent(payload: Partial<Event>): Promise<Event> {
  return httpClient.post<Event>("/api/events", payload);
}
