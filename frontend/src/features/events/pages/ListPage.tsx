import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Search,
  RefreshCcw,
  Eye,
  Edit,
  Trash,
  AlertTriangle,
  Building2,
  MapPin,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEventsStore } from '@/store';
import { eventsApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatShortLocalDate } from '@/utils/dates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AppBreadcrumbs } from '@/components/breadcrumbs';
import {
  getStatusBadgeVariant,
  getStatusLabel,
  canEditEvent,
  getPriorityBadgeVariant,
  getPriorityLabel,
} from '@/features/events/utils/status-helpers';
import {
  buildEventSortConfig,
  getEventTableManualSort,
  getNextEventTableSort,
  sortEvents,
  type EventTableManualSort,
  type EventTableSortField,
} from '@/features/events/utils/list-sorting';
import { getEditBlockReason } from '@/features/events/utils/edit-event';
import { useEventPermissions } from '@/features/events/hooks/useEventPermissions';
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Event, EventFilters } from '@/models/event';
import type { EventStatus } from '@/models/event-status';

type SimpleDateRangeFilter = 'all' | 'today' | 'next7days' | 'thisMonth';

function toLocalDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(baseDate: Date, days: number): Date {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getNext7DaysRange() {
  const today = new Date();

  return {
    startDate: toLocalDateParam(today),
    endDate: toLocalDateParam(addDays(today, 7)),
  };
}

function getCurrentMonthRange() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: toLocalDateParam(firstDayOfMonth),
    endDate: toLocalDateParam(lastDayOfMonth),
  };
}

function getEffectiveDateRange(filters: EventFilters) {
  return {
    startDate: filters.startDate ?? filters.dateFrom,
    endDate: filters.endDate ?? filters.dateTo,
  };
}

function getSimpleDateRangeValue(filters: EventFilters): SimpleDateRangeFilter {
  const today = toLocalDateParam(new Date());
  const next7daysRange = getNext7DaysRange();
  const currentMonthRange = getCurrentMonthRange();
  const { startDate, endDate } = getEffectiveDateRange(filters);

  if (startDate === today && endDate === today) {
    return 'today';
  }

  if (
    startDate === next7daysRange.startDate &&
    endDate === next7daysRange.endDate
  ) {
    return 'next7days';
  }

  if (
    startDate === currentMonthRange.startDate &&
    endDate === currentMonthRange.endDate
  ) {
    return 'thisMonth';
  }

  return 'all';
}

function matchesEventFilters(event: Event, filters: EventFilters): boolean {
  const search = filters.search?.trim().toLowerCase();
  const { startDate, endDate } = getEffectiveDateRange(filters);

  if (search && !event.name.toLowerCase().includes(search)) {
    return false;
  }

  if (filters.status?.length && !filters.status.includes(event.status)) {
    return false;
  }

  if (filters.internal !== undefined && event.internal !== filters.internal) {
    return false;
  }

  if (startDate && event.date < startDate) {
    return false;
  }

  if (endDate && event.date > endDate) {
    return false;
  }

  return true;
}

interface SortableHeaderProps {
  field: EventTableSortField;
  label: string;
  sort: EventTableManualSort | null;
  onSort: (field: EventTableSortField) => void;
  title?: string;
}

function SortableHeader({
  field,
  label,
  sort,
  onSort,
  title,
}: SortableHeaderProps) {
  const sortState = sort?.field === field ? sort.order : null;
  const Icon = sortState === 'asc' ? ArrowUp : sortState === 'desc' ? ArrowDown : ArrowUpDown;
  const ariaSort =
    sortState === 'asc'
      ? 'ascending'
      : sortState === 'desc'
      ? 'descending'
      : 'none';

  return (
    <th scope="col" aria-sort={ariaSort} className="pb-3 pr-4">
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'group inline-flex items-center gap-2 text-left transition-colors hover:text-foreground',
          sortState ? 'text-foreground' : 'text-muted-foreground'
        )}
        title={title ?? `Ordenar por ${label.toLowerCase()}`}
      >
        <span>{label}</span>
        <Icon
          className={cn(
            'h-4 w-4 flex-shrink-0 transition-opacity',
            sortState ? 'opacity-100' : 'opacity-50 group-hover:opacity-80'
          )}
        />
      </button>
    </th>
  );
}

export function ListPage() {
  const navigate = useNavigate();
  
  const {
    filters,
    sort,
    loading,
    setFilters,
    setSort,
    deleteEvent,
  } = useEventsStore();

  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  const [manualSort, setManualSort] = useState<EventTableManualSort | null>(() =>
    getEventTableManualSort(sort)
  );
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Baja lógica permitida en cualquier estado; solo depende del rol (sin evento => sin ownership)
  const { canDeleteEvent, canUpdateEvent } = useEventPermissions(null);
  const can = useCan();
  const canCreateEvent = can('create', 'Event');
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  const loadEvents = useCallback(async () => {
    setListLoading(true);
    setListError(null);

    try {
      const nextEvents = await eventsApi.listActive();
      setAllEvents(nextEvents);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los eventos';
      setListError(message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Debounce búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== filters.search) {
        setFilters({ search: searchQuery });
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, filters.search, setFilters]);

  const handleStatusFilterChange = (value: string) => {
    if (value === 'all') {
      setFilters({ status: undefined });
    } else {
      setFilters({ status: [value as EventStatus] });
    }

    setCurrentPage(1);
  };

  const handleTypeFilterChange = (value: string) => {
    if (value === 'all') {
      setFilters({ internal: undefined });
    } else {
      setFilters({ internal: value === 'internal' });
    }

    setCurrentPage(1);
  };

  const handleDateRangeFilterChange = (value: string) => {
    const today = toLocalDateParam(new Date());
    const next7daysRange = getNext7DaysRange();
    const currentMonthRange = getCurrentMonthRange();

    if (value === 'all') {
      setFilters({
        startDate: undefined,
        endDate: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
      setCurrentPage(1);
      return;
    }

    if (value === 'today') {
      setFilters({
        startDate: today,
        endDate: today,
        dateFrom: today,
        dateTo: today,
      });
      setCurrentPage(1);
      return;
    }

    if (value === 'thisMonth') {
      setFilters({
        startDate: currentMonthRange.startDate,
        endDate: currentMonthRange.endDate,
        dateFrom: currentMonthRange.startDate,
        dateTo: currentMonthRange.endDate,
      });
      setCurrentPage(1);
      return;
    }

    setFilters({
      startDate: next7daysRange.startDate,
      endDate: next7daysRange.endDate,
      dateFrom: next7daysRange.startDate,
      dateTo: next7daysRange.endDate,
    });
    setCurrentPage(1);
  };

  const handleDeleteClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDeleteEvent) {
      toast.error('No tenés permiso para eliminar eventos');
      return;
    }
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!canEditEvent(event.status)) {
      toast.error('No se puede editar', {
        description: getEditBlockReason(event.status),
      });
      return;
    }

    navigate(`/events/${event.id}/edit`);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;

    const success = await deleteEvent(eventToDelete.id);
    
    if (success) {
      await loadEvents();
      toast.success('Evento eliminado correctamente');
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    } else {
      toast.error('Error al eliminar el evento');
    }
  };

  const getAudienceTypeLabel = (audienceType: string) => {
    const labels: Record<string, string> = {
      ESTUDIANTES: 'Estudiantes',
      COMUNIDAD: 'Comunidad',
      MIXTO: 'Mixto',
      DOCENTES: 'Docentes',
      AUTORIDADES: 'Autoridades',
    };
    return labels[audienceType] || audienceType;
  };

  const handleSortChange = (field: EventTableSortField) => {
    const nextManualSort = getNextEventTableSort(manualSort, field);

    setManualSort(nextManualSort);
    setSort(buildEventSortConfig(nextManualSort));
    setCurrentPage(1);
  };

  const getTechSupportLabel = (mode: string | null) => {
    if (!mode) return 'Con técnica';
    const labels: Record<string, string> = {
      SETUP_ONLY: 'Solo montaje',
      ATTENDED: 'Acompañamiento completo',
    };
    return labels[mode] || 'Con técnica';
  };

  const filteredEvents = sortEvents(
    allEvents.filter((event) => matchesEventFilters(event, filters)),
    sort
  );
  const totalEvents = filteredEvents.length;
  const totalPages = totalEvents === 0 ? 0 : Math.ceil(totalEvents / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  const paginatedEvents = filteredEvents.slice(
    (safePage - 1) * pageSize,
    (safePage - 1) * pageSize + pageSize
  );

  useEffect(() => {
    if (safePage !== currentPage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <AppBreadcrumbs />
        
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Eventos</h1>
            <p className="text-muted-foreground">
              Gestión completa de eventos institucionales. Configurá horarios, espacios, técnica y más.
            </p>
          </div>
          
          {canCreateEvent ? (
            <Button onClick={() => navigate('/events/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo evento
            </Button>
          ) : null}
        </div>
      </div>

      {/* Toolbar: Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar eventos por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtro Estado */}
            <Select
              value={filters.status?.[0] || 'all'}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="EN_REVISION">En Revisión</SelectItem>
                <SelectItem value="RESERVADO">Reservado</SelectItem>
                <SelectItem value="APROBADO">Aprobado</SelectItem>
                <SelectItem value="RECHAZADO">Rechazado</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro Tipo */}
            <Select
              value={
                filters.internal === undefined
                  ? 'all'
                  : filters.internal
                  ? 'internal'
                  : 'public'
              }
              onValueChange={handleTypeFilterChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="internal">Internos</SelectItem>
                <SelectItem value="public">Públicos</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro Fecha */}
            <Select
              value={getSimpleDateRangeValue(filters)}
              onValueChange={handleDateRangeFilterChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas las fechas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="next7days">Próximos 7 días</SelectItem>
                <SelectItem value="thisMonth">Este mes</SelectItem>
                <SelectItem value="all">Todas las fechas</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => void loadEvents()}
              disabled={listLoading}
            >
              <RefreshCcw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {listError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{listError}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Eventos Registrados</CardTitle>
              <CardDescription>
                {totalEvents} eventos en total
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listLoading && allEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Cargando eventos...
            </div>
          ) : paginatedEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron eventos con los filtros aplicados
            </div>
          ) : (
            <>
              {/* Tabla Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left text-sm font-medium text-muted-foreground">
                      <SortableHeader
                        field="date"
                        label="Fecha y horario"
                        sort={manualSort}
                        onSort={handleSortChange}
                        title="Click para alternar entre ascendente, descendente y el orden por defecto."
                      />
                      <SortableHeader
                        field="name"
                        label="Evento"
                        sort={manualSort}
                        onSort={handleSortChange}
                      />
                      <SortableHeader
                        field="location"
                        label="Ubicación"
                        sort={manualSort}
                        onSort={handleSortChange}
                      />
                      <SortableHeader
                        field="department"
                        label="Departamento"
                        sort={manualSort}
                        onSort={handleSortChange}
                      />
                      <SortableHeader
                        field="status"
                        label="Estado"
                        sort={manualSort}
                        onSort={handleSortChange}
                        title="Ascendente: Solicitado, En revisión, Reservado, Aprobado, Rechazado."
                      />
                      <SortableHeader
                        field="priority"
                        label="Prioridad"
                        sort={manualSort}
                        onSort={handleSortChange}
                        title="Ascendente: Baja, Media, Alta. El tercer click restaura el orden por defecto."
                      />
                      <SortableHeader
                        field="technique"
                        label="Técnica"
                        sort={manualSort}
                        onSort={handleSortChange}
                        title="Ascendente: sin técnica, solo montaje, con técnica, acompañamiento completo."
                      />
                      <SortableHeader
                        field="type"
                        label="Tipo"
                        sort={manualSort}
                        onSort={handleSortChange}
                        title="Ascendente: Interno, Público."
                      />
                      <th scope="col" className="pb-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEvents.map((event) => (
                      <tr
                        key={event.id}
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/events/${event.id}`)}
                      >
                        {/* Fecha y horario */}
                        <td className="py-4 pr-4">
                          <div className="space-y-0.5">
                            <div className="font-semibold">{formatShortLocalDate(event.date)}</div>
                            <div className="text-sm text-muted-foreground">
                              {event.scheduleFrom} – {event.scheduleTo}
                            </div>
                          </div>
                        </td>

                        {/* Evento */}
                        <td className="py-4 pr-4">
                          <div className="space-y-0.5">
                            <div className="font-medium max-w-[250px] truncate" title={event.name}>
                              {event.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {event.audienceType
                                ? getAudienceTypeLabel(event.audienceType)
                                : event.requestingArea || '—'}
                            </div>
                          </div>
                        </td>

                        {/* Ubicación */}
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            {event.space ? (
                              <>
                                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm max-w-[150px] truncate" title={event.space.name}>
                                  {event.space.name}
                                </span>
                              </>
                            ) : event.freeLocation ? (
                              <>
                                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm max-w-[150px] truncate" title={event.freeLocation}>
                                  {event.freeLocation}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>

                        {/* Departamento */}
                        <td className="py-4 pr-4">
                          {event.department ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: event.department.colorHex }}
                              />
                              <span className="text-sm max-w-[150px] truncate" title={event.department.name}>
                                {event.department.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-4 pr-4">
                          <Badge 
                            variant={getStatusBadgeVariant(event.status)}
                            className={event.status === 'RECHAZADO' ? 'border-red-300 text-red-700 ring-red-200' : ''}
                          >
                            {getStatusLabel(event.status)}
                          </Badge>
                        </td>

                        {/* Prioridad */}
                        <td className="py-4 pr-4">
                          <Badge 
                            variant={getPriorityBadgeVariant(event.priority)}
                            className={event.priority === 'HIGH' ? 'border-red-300 text-red-700 ring-red-200' : ''}
                          >
                            {getPriorityLabel(event.priority)}
                          </Badge>
                        </td>

                        {/* Técnica */}
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            {event.requiresTech ? (
                              <Badge variant="outline" className="text-xs" title={getTechSupportLabel(event.techSupportMode)}>
                                {getTechSupportLabel(event.techSupportMode)}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                            {event.requiresRebooking && (
                              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            )}
                          </div>
                        </td>

                        {/* Tipo */}
                        <td className="py-4 pr-4">
                          <Badge variant={event.internal ? 'default' : 'outline'} className="text-xs">
                            {event.internal ? 'INTERNO' : 'PÚBLICO'}
                          </Badge>
                        </td>

                        {/* Acciones */}
                        <td className="py-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/events/${event.id}`);
                              }}
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canUpdateEvent ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleEditClick(event, e)}
                                title={canEditEvent(event.status) ? 'Editar evento' : 'Ver motivo de bloqueo'}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            ) : null}
                            {canDeleteEvent ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleDeleteClick(event, e)}
                                title="Eliminar evento"
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards Mobile */}
              <div className="md:hidden space-y-4">
                {paginatedEvents.map((event) => (
                  <Card
                    key={event.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/events/${event.id}`)}
                  >
                    <CardContent className="pt-6 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-base">{event.name}</div>
                        <Badge 
                          variant={getStatusBadgeVariant(event.status)} 
                          className={event.status === 'RECHAZADO' ? 'border-red-300 text-red-700 ring-red-200 flex-shrink-0' : 'flex-shrink-0'}
                        >
                          {getStatusLabel(event.status)}
                        </Badge>
                      </div>

                      {/* Info principal */}
                      <div className="text-sm space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatShortLocalDate(event.date)}</span>
                          <span className="text-muted-foreground">
                            {event.scheduleFrom} – {event.scheduleTo}
                          </span>
                        </div>

                        {event.space || event.freeLocation ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {event.space ? (
                              <>
                                <Building2 className="w-4 h-4" />
                                <span>{event.space.name}</span>
                              </>
                            ) : (
                              <>
                                <MapPin className="w-4 h-4" />
                                <span>{event.freeLocation}</span>
                              </>
                            )}
                          </div>
                        ) : null}

                        {event.department && (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: event.department.colorHex }}
                            />
                            <span className="text-muted-foreground">{event.department.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge 
                          variant={getPriorityBadgeVariant(event.priority)}
                          className={event.priority === 'HIGH' ? 'border-red-300 text-red-700 ring-red-200' : ''}
                        >
                          {getPriorityLabel(event.priority)}
                        </Badge>
                        <Badge variant={event.internal ? 'default' : 'outline'}>
                          {event.internal ? 'INTERNO' : 'PÚBLICO'}
                        </Badge>
                        {event.requiresTech && (
                          <Badge variant="outline">
                            {getTechSupportLabel(event.techSupportMode)}
                          </Badge>
                        )}
                        {event.requiresRebooking && (
                          <Badge variant="outline" className="text-orange-600">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Reprogramar
                          </Badge>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/events/${event.id}`);
                          }}
                          className="flex-1"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver
                        </Button>
                        {canUpdateEvent ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleEditClick(event, e)}
                            title={canEditEvent(event.status) ? 'Editar evento' : 'Ver motivo de bloqueo'}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        ) : null}
                        {canDeleteEvent && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleDeleteClick(event, e)}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Página {safePage} de {totalPages} · {totalEvents} eventos
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value) as 10 | 20 | 50);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                    disabled={safePage === 1 || listLoading}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                    disabled={safePage >= totalPages || listLoading}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Confirmar Eliminación */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar evento?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El evento "{eventToDelete?.name}" será eliminado permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setEventToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={loading.delete}>
              {loading.delete ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
