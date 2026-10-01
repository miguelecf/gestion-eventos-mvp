# Matriz de permisos (contrato)

El backend (`SecurityConfig` y los servicios) es la autoridad. CASL (`ability.ts`), las rutas y los hooks de UI reflejan esta tabla **sin agregar ni quitar permisos**.

Roles: **AF** = ADMIN_FULL · **AC** = ADMIN_CEREMONIAL · **AT** = ADMIN_TECNICA · **U** = USUARIO · **Pub** = sin login.

| Recurso / acción | Endpoint | Pub | U | AC | AT | AF |
|---|---|:-:|:-:|:-:|:-:|:-:|
| Crear solicitud de evento | `POST /public/event-requests` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Seguimiento de solicitud (DTO público mínimo) | `GET /public/track/{uuid}` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Calendario público / espacios / disponibilidad pública | `GET /public/events`, `/public/catalogs/spaces`, `POST /public/availability/check`, `GET /public/spaces/*/occupancy` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Listar solicitudes (bandeja) | `GET /admin/event-requests` | | | ✔ | ✔ | ✔ |
| Detalle, historial, estado, conversión de solicitud | `/admin/event-requests/**` | | | ✔ | ✔ | ✔ |
| Ver eventos | `GET /api/events/**` | | ✔ | ✔ | ✔ | ✔ |
| Crear / editar / dar de baja eventos | `POST /api/events`, `PATCH /api/events/{id}`, `PATCH /api/events/{id}/soft-delete` | | | ✔ | ✔ | ✔ |
| Cambiar estado del evento | `GET/POST /api/events/{id}/status` | | | ✔¹ | ✔¹ | ✔ |
| Comentarios internos | `/api/events/{id}/comments/**` | | | ✔ | ✔ | ✔ |
| Auditoría de evento | `GET /api/audit/**` | | | ✔ | ✔ | ✔ |
| Chequeo de disponibilidad interno | `POST /api/availability/check` | | ✔ | ✔ | ✔ | ✔ |
| Ver capacidad técnica | `GET /api/tech/**` | | | ✔ | ✔ | ✔ |
| Ver conflictos de prioridad | `GET /api/priority/conflicts/**` | | | ✔ | ✔ | ✔ |
| Resolver conflictos de prioridad | `POST /api/priority/decisions` | | | ✔ | | ✔ |
| Catálogos (espacios, departamentos) | `/api/catalogs/**` | | | ✔ | ✔ | ✔ |
| Usuarios y roles | `/api/users/**`, `POST /auth/register` | | | | | ✔ |
| Notificaciones propias | `/api/notifications/**` | | ✔ | ✔ | ✔ | ✔ |
| Perfil y cambio de contraseña propio | `GET /auth/me`, `POST /auth/change-password` | | ✔ | ✔ | ✔ | ✔ |

¹ AC solo puede dar o quitar `ceremonialOk`; AT solo `technicalOk`; AF ambas.

## Reglas de negocio asociadas
- **USUARIO** no crea eventos. Crea **solicitudes**, que entran en `RECIBIDO` y siguen el circuito de revisión.
- **Aprobación (`APROBADO`):** requiere siempre `ceremonialOk` **y** `technicalOk`, aunque el evento no requiera soporte técnico. La conformidad técnica es institucional y obligatoria.
- **Decisiones de conflicto de prioridad:** solo `REBOOK_OTHER` y `KEEP_ORIGINAL`.
- **El decisor** de un conflicto es siempre el usuario autenticado; nunca lo informa el cliente.
- **Rechazar** un evento o una solicitud exige un motivo, y el backend lo valida.
