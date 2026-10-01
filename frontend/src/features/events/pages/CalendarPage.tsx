import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DateSelectArg, EventClickArg } from '@fullcalendar/core';
import { eventsApi } from '@/services/api';
import type { Event } from '@/models/event';
import { useCan } from '@/hooks/useCan';

interface CalendarEvent extends EventInput {
  extendedProps: {
    calendar: 'danger' | 'success' | 'primary' | 'warning';
    department?: string;
    space?: string;
    priority?: string;
    status?: string;
  };
}

export function CalendarPage() {
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ========== CARGAR EVENTOS ==========
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar eventos activos del backend (devuelve un array directo)
      const data = await eventsApi.listActive();
      
      const calendarEvents: CalendarEvent[] = data.map((event: Event) => ({
        id: event.id.toString(),
        title: event.name,
        start: `${event.date}T${event.scheduleFrom}`,
        end: `${event.date}T${event.scheduleTo}`,
        extendedProps: {
          calendar: getPriorityColor(event.priority),
          department: event.department?.name || '',
          space: event.space?.name || event.freeLocation || '',
          priority: event.priority,
          status: event.status,
        },
      }));
      setEvents(calendarEvents);
    } catch (err) {
      console.error('Error loading events:', err);
      setError('No se pudieron cargar los eventos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // ========== HANDLERS ==========
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const eventId = parseInt(clickInfo.event.id);
    navigate(`/events/${eventId}`);
  }, [navigate]);

  const canCreateEvent = useCan()('create', 'Event');

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    const dateStr = selectInfo.startStr;
    navigate(`/events/new?date=${dateStr}`);
  }, [navigate]);

  // ========== RENDER ==========
  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-red-600 dark:text-red-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Error al cargar eventos</p>
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
            <button
              onClick={loadEvents}
              className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Calendar Card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Calendario de Eventos
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Vista de eventos programados
            </p>
          </div>

          <div className="custom-calendar">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              locale="es"
              firstDay={1}
              events={events}
              selectable={canCreateEvent}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              height="auto"
              nowIndicator={true}
              businessHours={{
                daysOfWeek: [1, 2, 3, 4, 5],
                startTime: '08:00',
                endTime: '18:00',
              }}
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              buttonText={{
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
              }}
            />
          </div>
        </div>
      </div>

      {/* Leyenda de Prioridades */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Leyenda de Prioridades
        </h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Prioridad Alta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Prioridad Media</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Prioridad Baja</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Sin prioridad</span>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Cargando eventos...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== HELPERS ==========

function getPriorityColor(priority?: string): 'danger' | 'success' | 'primary' | 'warning' {
  switch (priority) {
    case 'HIGH':
      return 'danger';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
      return 'primary';
    default:
      return 'success';
  }
}

function renderEventContent(eventInfo: {
  timeText: string;
  event: {
    title: string;
    extendedProps: {
      calendar: string;
      space?: string;
    };
  };
}) {
  const colorClass = `fc-bg-${eventInfo.event.extendedProps.calendar}`;
  return (
    <div className={`event-fc-color flex flex-col ${colorClass} p-1 rounded-sm`}>
      <div className="fc-event-time text-xs font-semibold">{eventInfo.timeText}</div>
      <div className="fc-event-title text-xs truncate">{eventInfo.event.title}</div>
      {eventInfo.event.extendedProps.space && (
        <div className="fc-event-location text-[10px] opacity-75">
          📍 {eventInfo.event.extendedProps.space}
        </div>
      )}
    </div>
  );
}

