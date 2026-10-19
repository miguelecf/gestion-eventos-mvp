# Matriz de permisos (contrato)

La **fuente de verdad** de los permisos es la matriz única [`frontend/src/libs/permisos.json`](../frontend/src/libs/permisos.json) (SEC-04). Cada fila asigna roles a la vez a endpoints y a acciones de CASL, y la leen dos consumidores:

- **CASL:** `frontend/src/libs/ability.ts` arma las reglas de la interfaz leyendo la matriz. Lo que no figura queda denegado (tampoco `ADMIN_FULL` tiene un `manage all` genérico: recibe exactamente las filas en las que figura). Rutas (`RoleRoute`) y sidebar consultan esas reglas.
- **Backend:** `PermissionMatrixIntegrationTest` verifica que la matriz tenga exactamente los mismos endpoints que los controllers, que `SecurityConfig` permita o niegue cada endpoint a cada rol (y al anónimo) tal como dice la matriz, y que los `@PreAuthorize` de los controllers coincidan con los roles de su fila.

**Qué no verifica el test:** que cada par de `casl` esté en la fila correcta (es una revisión humana); las filas sin endpoints, cuyas reglas aplican los servicios; y la evaluación usa una sola instancia de cada ruta (variables reemplazadas por `1`), suficiente para los patrones Ant actuales.

La autorización efectiva la aplica el backend (`SecurityConfig` y, donde corresponda, los servicios). CASL refleja el contrato en la interfaz y no reemplaza los controles del servidor.

El JSON vive en `frontend/` porque la imagen Docker del frontend solo copia esa carpeta; el test backend lo lee con la ruta relativa `../frontend/src/libs/permisos.json`.

## Formato de la matriz

Roles: `USUARIO`, `ADMIN_CEREMONIAL`, `ADMIN_TECNICA`, `ADMIN_FULL`. Cada fila de `permissions` tiene:

| Campo | Significado |
|---|---|
| `id` | Nombre estable del permiso (`event.create`, `catalog.read`…). |
| `description` | Qué habilita, en lenguaje de negocio. |
| `public` | `true` si no requiere login; vale para anónimos y para todos los roles. |
| `roles` | Roles que lo tienen, si no es público. |
| `casl` | Pares `{action, subject}` que habilita en la interfaz; vacío si no hay acción de UI. |
| `endpoints` | `"MÉTODO /ruta"` exactamente como los mapean los controllers. Vacío si la regla la aplica un servicio dentro de otro endpoint. |

Reglas aplicadas por servicios, dentro de endpoints de la matriz:

- `event.approveCeremonial` / `event.approveTechnical`: dentro de `POST /api/events/{id}/status`, AC solo puede dar o quitar `ceremonialOk`, AT solo `technicalOk` y AF ambas (`EventStatusService`).
- `event.internal`: el flag `internal` viaja en `PATCH /api/events/{id}`; el backend no lo controla aparte de `event.update` (mismos roles). La fila existe para mostrar u ocultar el control en la interfaz.
- `comment.update` / `comment.delete`: `EventCommentService` permite editar o borrar al autor y a los roles privilegiados (AF, AC, AT); como esos son los roles de la fila, no restringe más.

## Infraestructura (fuera de la matriz)

No son controllers propios, así que no figuran en el JSON. Ningún otro endpoint es público: lo que no figura como `public` en la matriz exige login. `ActuatorAndCorsIntegrationTests` cubre la salud (`readiness`) y el preflight CORS; Swagger no tiene test.

| Recurso | Endpoint | Acceso |
|---|---|---|
| Salud del servicio | `GET /actuator/health`, `/actuator/health/**`, `/actuator/info` | Público |
| Swagger / OpenAPI | `/swagger-ui/**`, `/swagger-ui.html`, `/v3/api-docs/**`, `/api-docs/**` | Público |
| Preflight CORS | `OPTIONS /**` | Público |

## Checklist para cambiar permisos

- [ ] Editar la fila en `frontend/src/libs/permisos.json` (o agregarla si hay un endpoint nuevo).
- [ ] Ajustar la regla efectiva en `backend/src/main/java/com/mvp/backend/config/SecurityConfig.java` (y la autorización del servicio, si aplica).
- [ ] Correr `PermissionMatrixIntegrationTest`: falla si la matriz y `SecurityConfig` o los controllers no coinciden. Agregar un test de integración de comportamiento si el cambio lo amerita (por ejemplo, `UsuarioPermissionsIntegrationTest`).
- [ ] Si se agrega una acción o un sujeto de CASL, sumarlo a `ACTIONS`/`SUBJECTS` en `ability.ts`; un valor desconocido en la matriz hace fallar la carga del módulo.
- [ ] Revisar rutas (`frontend/src/app/routes.tsx`) y sidebar (`frontend/src/components/app-sidebar.tsx`) si cambia la navegación visible.

## Reglas de negocio asociadas
- **USUARIO** no crea eventos. Crea **solicitudes**, que entran en `RECIBIDO` y siguen el circuito de revisión.
- **Aprobación (`APROBADO`):** requiere siempre `ceremonialOk` **y** `technicalOk`, aunque el evento no requiera soporte técnico. La conformidad técnica es institucional y obligatoria.
- **Decisiones de conflicto de prioridad:** solo `REBOOK_OTHER` y `KEEP_ORIGINAL`.
- **El decisor** de un conflicto es siempre el usuario autenticado; nunca lo informa el cliente.
- **Rechazar** un evento o una solicitud exige un motivo, y el backend lo valida.
