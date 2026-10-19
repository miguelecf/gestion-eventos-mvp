# Matriz de permisos (contrato)

Este documento es la **fuente de verdad del contrato de permisos documentado**. La autorización efectiva la aplica el backend (`SecurityConfig` y, donde corresponda, los servicios); CASL (`frontend/src/libs/ability.ts`), las rutas y el sidebar reflejan este contrato en la interfaz y no reemplazan los controles del servidor.

Roles: **AF** = ADMIN_FULL · **AC** = ADMIN_CEREMONIAL · **AT** = ADMIN_TECNICA · **U** = USUARIO · **Pub** = sin login.

| Recurso / acción | Endpoint | Pub | U | AC | AT | AF |
|---|---|:-:|:-:|:-:|:-:|:-:|
| Iniciar sesión | `POST /auth/login` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Renovar sesión | `POST /auth/refresh` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Cerrar sesión | `POST /auth/logout` | | ✔ | ✔ | ✔ | ✔ |
| Salud del servicio | `GET /actuator/health`, `/actuator/health/**`, `/actuator/info` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Swagger / OpenAPI | `/swagger-ui/**`, `/swagger-ui.html`, `/v3/api-docs/**`, `/api-docs/**` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Crear solicitud de evento | `POST /public/event-requests` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Seguimiento de solicitud (DTO público mínimo) | `GET /public/track/{uuid}` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Calendario público / espacios / disponibilidad pública | `GET /public/events`, `/public/catalogs/spaces`, `POST /public/availability/check`, `GET /public/spaces/*/occupancy` | ✔ | ✔ | ✔ | ✔ | ✔ |
| Listar solicitudes (bandeja) | `GET /admin/event-requests` | | | ✔ | ✔ | ✔ |
| Detalle, historial, estado, conversión de solicitud | `/admin/event-requests/**` | | | ✔ | ✔ | ✔ |
| Ver eventos | `GET /api/events/**` | | ✔ | ✔ | ✔ | ✔ |
| Crear / editar / dar de baja eventos | `POST /api/events`, `PATCH /api/events/{id}`, `PATCH /api/events/{id}/soft-delete`; cualquier otro método no `GET` sobre `/api/events/**` queda reservado a admins | | | ✔ | ✔ | ✔ |
| Cambiar estado del evento | `GET/POST /api/events/{id}/status` | | | ✔¹ | ✔¹ | ✔ |
| Comentarios internos | `/api/events/{id}/comments/**` | | | ✔ | ✔ | ✔ |
| Auditoría de evento | `GET /api/audit/**` | | | ✔ | ✔ | ✔ |
| Chequeo de disponibilidad interno | `POST /api/availability/check` | | ✔ | ✔ | ✔ | ✔ |
| Ver capacidad técnica | `GET /api/tech/**` | | | ✔ | ✔ | ✔ |
| Ver conflictos de prioridad | `GET /api/priority/conflicts/**` | | | ✔ | ✔ | ✔ |
| Resolver conflictos de prioridad | `POST /api/priority/decisions` | | | ✔ | | ✔ |
| Ver catálogos (espacios, departamentos) | `GET /api/catalogs/**` | | ✔ | ✔ | ✔ | ✔ |
| Administrar catálogos | `POST/PATCH /api/catalogs/**` | | | ✔ | ✔ | ✔ |
| Usuarios y roles | `/api/users/**`, `POST /auth/register` | | | | | ✔ |
| Notificaciones propias | `/api/notifications/**` | | ✔ | ✔ | ✔ | ✔ |
| Perfil y cambio de contraseña propio | `GET /auth/me`, `POST /auth/change-password` | | ✔ | ✔ | ✔ | ✔ |

¹ AC solo puede dar o quitar `ceremonialOk`; AT solo `technicalOk`; AF ambas.

## Checklist para cambiar permisos

Al cambiar un permiso, actualizar y verificar en conjunto:

- [ ] Esta matriz (`docs/permisos.md`), incluyendo rol y método HTTP.
- [ ] La regla efectiva en `backend/src/main/java/com/mvp/backend/config/SecurityConfig.java` (y la autorización del servicio si aplica).
- [ ] El test de integración correspondiente en `backend/src/test/java/com/mvp/backend/security/` (por ejemplo, `UsuarioPermissionsIntegrationTest`); para health/CORS, revisar `ActuatorAndCorsIntegrationTests`.
- [ ] Las capacidades de interfaz en `frontend/src/libs/ability.ts`, si la acción está representada por CASL.
- [ ] Las rutas (`frontend/src/app/routes.tsx`) y el sidebar (`frontend/src/components/app-sidebar.tsx`), si cambia el acceso o la navegación visible.

La matriz no vuelve públicos endpoints que no estén configurados como tales. El permiso público de actuator y Swagger se limita a las rutas indicadas arriba, según `SecurityConfig`.

## Reglas de negocio asociadas
- **USUARIO** no crea eventos. Crea **solicitudes**, que entran en `RECIBIDO` y siguen el circuito de revisión.
- **Aprobación (`APROBADO`):** requiere siempre `ceremonialOk` **y** `technicalOk`, aunque el evento no requiera soporte técnico. La conformidad técnica es institucional y obligatoria.
- **Decisiones de conflicto de prioridad:** solo `REBOOK_OTHER` y `KEEP_ORIGINAL`.
- **El decisor** de un conflicto es siempre el usuario autenticado; nunca lo informa el cliente.
- **Rechazar** un evento o una solicitud exige un motivo, y el backend lo valida.
