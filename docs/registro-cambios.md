# Registro de cambios por ticket

Bitácora de los tickets `SEC-xx` (seguridad) y `REQ-xx` (requisitos) del sistema de tickets externo. Los tickets se revisan de a uno, aunque el hallazgo figure como corregido en [el historial](historial/hallazgos-2026-10.md): primero se verifica el código y el test, y después se corrige o se agrega cobertura.

- **Horario:** hora del commit, en Argentina (UTC−03:00).
- **Commit:** hash corto del commit que contiene el cambio. Los commits que solo actualizan esta bitácora no se registran.
- **Estado:** `verificado` (ya estaba corregido; solo se agregó cobertura) o `corregido` (había una fuga y se arregló) o `cumplido` (requisito ya implementado; solo se verificó y documentó).

## Log

| Fecha y hora | Ticket | Commit | Tipo | Cambio | Verificación |
|---|---|---|---|---|---|
| 2026-10-11 12:26 | SEC-01 | `fb280b3` | test | Test de borde: el tracking no expone el motivo ni la nota internos del rechazo de un evento convertido. | `PublicTrackingIntegrationTest` 2/2 |
| 2026-10-17 14:52 | SEC-02 | `187ac5f` | fix | `GET /public/events` responde `PublicEventDto` en lugar del DTO interno; sin contacto del solicitante ni datos de gestión. | `PublicEventsIntegrationTest`; suite backend 48/48; frontend `tsc -b`, build y lint |
| 2026-10-17 16:06 | SEC-02 | `002aad7` | test | El calendario público expone exactamente los campos de `PublicEventDto` y solo eventos aprobados, activos y no internos; cubre `freeLocation` sin espacio. | `PublicEventsIntegrationTest` 2/2 |
| 2026-10-19 08:48 | SEC-03 | `b8c17b9` | fix | Toda escritura (cualquier método no `GET`) sobre `/api/events/**` queda reservada a admins; antes `PUT`/`DELETE` caían en `anyRequest().authenticated()`. | `UsuarioPermissionsIntegrationTest` 4/4 (rojo previo: 405 en vez de 403); suite backend en verde |
| 2026-10-19 08:56 | REQ-01 | `33a5b9d` | docs | Regla en decisiones funcionales: el área define `requiresTech` al convertir la solicitud y se conserva en el evento. Implementación original `226ca6a` (hallazgo 3.2). | `RequestConversionIntegrationTest` 2/2 |
| 2026-10-19 09:00 | REQ-02 | `96dd380` | fix | En la bandeja interna, `CONVERTIDO` deja el verde de `APROBADO` y pasa a celeste, con una descripción que aclara que no implica aprobación. Se corrigen el texto de la confirmación pública y el schema Zod de estados de solicitud, y se agrega la regla a decisiones funcionales. Tracking y correo ya estaban corregidos en `eaf4a8d` (hallazgo 2.1). | frontend `tsc -b`, build y lint sin errores en los archivos tocados |
| 2026-10-19 09:29 | SEC-04 | `05e11b7` | feat | Matriz única `frontend/src/libs/permisos.json`: `ability.ts` arma CASL desde ella y `PermissionMatrixIntegrationTest` la contrasta con los controllers, `SecurityConfig` y los `@PreAuthorize`. | `PermissionMatrixIntegrationTest` 3/3 y pruebas negativas; suite backend 53/53; frontend `tsc -b`, build y lint sin errores nuevos |
| 2026-10-24 09:53 | SEC-05 | `71b4faf` | fix | `GET /api/priority/conflicts/**` ya estaba restringido (hallazgo 1.6), pero `HEAD` como USUARIO daba 200: Spring MVC lo atiende con el handler `GET` y caía en `anyRequest().authenticated()`. Se agrega una regla para cualquier método sobre `/api/priority/**`. | `PriorityConflictAccessIntegrationTest` 5/5 (rojo previo: 200 en vez de 403) y prueba negativa; suite backend 55/55 |
| 2026-10-24 10:08 | SEC-06 | `c872cec` | test | El decisor de un conflicto ya salía del usuario autenticado (hallazgo 1.7). Test de `REBOOK_OTHER` con un `deciderUserId` falso: `decisionBy`, `lastModifiedBy` y el actor de las dos auditorías son el principal. | `PriorityConflictDecisionIntegrationTest` 3/3 y prueba negativa; suite backend 56/56 |

## SEC-01 — Comentarios internos en el tracking público

**Estado:** verificado. El fix original es `2b509af` (hallazgo 1.1, P0).

- `TrackingResponse` expone solo nombre, estados, agenda, ubicación legible, línea temporal y motivo de rechazo de la solicitud.
- `EventRequestService.buildTimeline` incluye solo `STATUS` y `SCHEDULE_CHANGE`/`REPROGRAM`, sin `details`; descarta comentarios, toggles de visibilidad, conformidades y el resto de la auditoría.
- `rejectionReason` toma solo el motivo de la solicitud; el del evento es interno.
- Los correos al solicitante incluyen solo el motivo de rechazo de la solicitud.
- **Cobertura agregada:** solicitud con motivo en un cambio de estado que no es rechazo, convertida y luego rechazada como evento con motivo y nota internos. El tracking muestra el evento `RECHAZADO`, sin `rejectionReason` y sin ninguno de los textos internos.

## SEC-02 — Acceso público al listado de solicitudes y sus datos personales

**Estado:** corregido.

- **Listado de solicitudes:** ya estaba eliminado en `4a992d4` (hallazgo 1.2, P0). `listadoPublicoDeSolicitudesYaNoExiste` lo cubre, y la bandeja `/admin/event-requests` rechaza a USUARIO y a anónimos.
- **Fuga abierta:** `GET /public/events` (anónimo) devolvía `EventResponseDto` completo. Al convertir una solicitud, el evento copia `contactName`, `contactEmail` y `contactPhone` (`EventRequestService`), de modo que el contacto del solicitante quedaba público, junto con el email de `createdBy`/`lastModifiedBy`, observaciones, buffers, flags de gestión y `originRequestId`.
- **Cambio:** `PublicEventDto` con id, nombre, fecha, horario, estado, prioridad, `spaceName`, `freeLocation` y `departmentName`. El frontend (`public-events.ts`, `PublicCalendarPage.tsx`) consume ese contrato. Regla registrada en [decisiones funcionales](decisiones-funcionales.md).
- **Decisión:** la prioridad se mantiene en el contrato público porque el calendario la usa para el color.
- **Verificación en OrbStack:** con el stack de Compose levantado, `GET /public/events` en `127.0.0.1:8080` devolvió solo los campos del DTO público. El E2E no se corrió; el smoke solo usa el `id` del evento, que se conserva.
- **Revisión con Pi:** `opencode-go/deepseek-v4-pro`, `openai/gpt-6.1-sol` y `minimax/MiniMax-M3`, en solo lectura. Los tres coincidieron en que la fuga queda cerrada y en que el resto de `/public/**` no expone datos personales ni de gestión. Se aceptaron sus huecos de test (lista exacta de campos, exclusión de internos/inactivos/no aprobados, `freeLocation`), cubiertos en `002aad7`.

## SEC-03 — Permisos de creación, edición y baja de eventos del rol USUARIO

**Estado:** corregido (endurecimiento). El fix original es `2d9a04f` (hallazgos 1.4 y 1.5, P0).

- **Ya cubierto:** USUARIO recibía 403 en `POST /api/events`, `PATCH /api/events/{id}`, `PATCH /api/events/{id}/soft-delete`, `POST /api/events/{id}/status` y comentarios (`@PreAuthorize` además de la regla). La conversión de solicitudes (`/admin/event-requests/**`) es solo para admins. En el frontend, CASL (`ability.ts`) niega `create`/`update`/`delete` sobre `Event` y las rutas de alta/edición usan `RoleRoute`.
- **Hueco:** las reglas eran por método (`PATCH` y `POST`). Un `PUT`/`DELETE` sobre `/api/events/**` caía en `anyRequest().authenticated()` y llegaba al dispatcher (405). Hoy no hay endpoints con esos métodos, pero uno futuro habría quedado abierto a USUARIO.
- **Cambio:** después de `GET /api/events/**` (que incluye a USUARIO), una regla sin método reserva el resto de `/api/events/**` a AF/AC/AT. Reemplaza las reglas sueltas de `PATCH` y `POST`. Actualizada la matriz de [permisos](permisos.md).
- **Cobertura agregada:** `PUT`/`DELETE` de USUARIO responden 403, y tras los intentos rechazados el evento conserva el nombre, el estado y `active`.
- **Revisión con Pi:** `opencode-go/deepseek-v4-pro`, `openai/gpt-6.1-sol` y `minimax/MiniMax-M3`, en solo lectura. Ninguno encontró hallazgos bloqueantes. Se descartaron dos notas menores: `HEAD` sobre `/api/events/**` ahora exige rol admin, pero no se usa y el contrato documenta solo `GET`; y una precisión de redacción del comentario, que ya describe el efecto real.

## REQ-01 — Preservar `requiresTech` al convertir solicitudes en eventos

**Estado:** cumplido. Implementado en `226ca6a` (hallazgo 3.2); este ticket solo agrega la regla a la documentación vigente.

- **Modelo:** la solicitud no tiene `requiresTech`; el solicitante solo informa `technicalSchedule`, que es informativo. El área lo define al convertir (`POST /admin/event-requests/{id}/convert-to-event`, body opcional `{requiresTech, techSupportMode}`), y `EventRequestService.convertToEvent` lo guarda en el evento.
- **Valores por defecto:** sin body, el evento queda con `requiresTech=false`. Con `true` y sin modo, el modo es `SETUP_ONLY`. Con `true`, se valida la capacidad técnica antes de crear el evento.
- **Interfaz:** el diálogo de conversión de `PublicRequestDetailPage` tiene un checkbox de soporte técnico y un selector de modo.
- **Documentación:** regla agregada a [decisiones funcionales](decisiones-funcionales.md) (`33a5b9d`). Antes figuraba solo en el historial y en el Javadoc del controller.
- **Cobertura:** `RequestConversionIntegrationTest` cubre la conversión con soporte `ATTENDED` y sin body (2/2). El rechazo por falta de capacidad técnica al convertir no tiene test; cargado en el [backlog](backlog.md#pendientes-detectados-en-la-segunda-iteración-tickets-secreq).

## REQ-02 — `CONVERTIDO` no equivale a `APROBADO`

**Estado:** corregido (parcialmente previo). El tracking público quedó corregido en `eaf4a8d` (hallazgo 2.1).

- **Ya cubierto:** `TrackingPage` usa el estado del evento cuando existe ("Convertida a evento · En revisión", "Reservada", "Aprobada") y el correo de conversión (`EmailNotificationListener`) aclara que falta la conformidad de Ceremonial y Técnica.
- **Restos corregidos:**
  - La bandeja y el detalle admin (`PublicRequestStatusBadge`, vía `models/public-request.ts`) mostraban `CONVERTIDO` con variante `success` y verde esmeralda, la misma semántica visual que `APROBADO`. Ahora usa `outline` y celeste (`sky`), y la descripción dice que la conversión no implica aprobación.
  - `RequestConfirmationPage` decía "Si es aprobada, el evento aparecerá en el calendario público". Ahora explica que la solicitud aceptada se convierte en evento y que aparece en el calendario cuando Ceremonial y Técnica lo aprueban.
  - `PublicRequestStatusSchema` (Zod, sin consumidores) modelaba la solicitud con `APROBADA`. Quedó alineado con `RequestStatus` del backend.
- **Documentación:** regla agregada a [decisiones funcionales](decisiones-funcionales.md).
- **Revisión con Pi:** `opencode-go/deepseek-v4-pro`, `openai/gpt-6.1-sol` y `minimax/MiniMax-M3`, en solo lectura. Ninguno encontró otro lugar que equipare `CONVERTIDO` con `APROBADO`. Se aceptó el schema Zod legado. Queda pendiente, fuera de alcance: `EventStatusSchema` usa estados de evento que no existen (`CANCELADO`, `PENDIENTE`, `REPROGRAMADO`); cargado en el [backlog](backlog.md#pendientes-detectados-en-la-segunda-iteración-tickets-secreq).

## SEC-04 — Matriz única de permisos entre backend y CASL

**Estado:** corregido. Antes había tres copias que se alineaban a mano (hallazgo 1.5): la tabla de `docs/permisos.md`, `SecurityConfig` y `ability.ts`.

- **Diseño (elegido por Miguel):** un JSON versionado como fuente única. Vive en `frontend/src/libs/` porque la imagen Docker del frontend solo copia `frontend/`; el test backend lo lee por ruta relativa (el build Docker del backend corre con `-DskipTests`).
- **CASL:** `ability.ts` arma las reglas desde la matriz, sin `cannot` explícitos (lo que no figura queda denegado). Valida acciones y sujetos al cargar el módulo. `ADMIN_FULL` deja de tener `manage all` y recibe sus filas; la pantalla de usuarios pasa a `manage User` (`routes.tsx`, sidebar). Se comparó rol por rol con la versión anterior: ninguna consulta de la UI pierde permisos.
- **Test:** `PermissionMatrixIntegrationTest` verifica:
  1. Que la matriz y los controllers tengan exactamente los mismos endpoints.
  2. Que `SecurityConfig` permita o niegue cada endpoint × rol (y anónimo) según la matriz, vía `WebInvocationPrivilegeEvaluator`, sin ejecutar los endpoints.
  3. Que los `@PreAuthorize` coincidan con los roles de su fila.
- **Pruebas negativas:**
  - Dar `event.create` a USUARIO en la matriz falla con "matriz=true, SecurityConfig=false".
  - Quitar un endpoint de la matriz falla el test de cobertura.
  - Quitar `ADMIN_TECNICA` del `@PreAuthorize` de comentarios falla el test de `@PreAuthorize`.
  - Todas se revirtieron.
- **Documentación:** `docs/permisos.md` explica la matriz, sus campos, las reglas que aplican los servicios, la infraestructura fuera de la matriz y qué no verifica el test. También se actualizaron `AGENTS.md` y `docs/arquitectura.md`.
- **Revisión con Pi:** `opencode-go/deepseek-v4-pro`, `openai/gpt-6.1-sol` y `minimax/MiniMax-M3`, en solo lectura.
  - **Aceptado:** el test no evaluaba `@PreAuthorize` (agregado); las descripciones de comentarios decían "limita al autor", pero `verifyAuthorOrPrivileged` también deja pasar a AF/AC/AT (corregido); la documentación prometía más de lo que verifica el test (precisado).
  - **Documentado como límite:** una sola instancia por ruta; el mapeo de `casl` a filas es revisión humana.
  - **Al backlog:** las filas sin endpoints (conformidades por rol), que no tienen test.
  - **Descartado:** que el `manage all` anterior excluyera acciones custom. En CASL, `manage` es comodín.

## SEC-05 — Conflictos pendientes restringidos según el rol

**Estado:** corregido. El hallazgo 1.6 (`9f0d668`) ya restringía `GET /api/priority/conflicts/**` a AF, AC y AT, y `POST /api/priority/decisions` a AF y AC, según la regla de [decisiones funcionales](decisiones-funcionales.md). La matriz (filas `priority.read` y `priority.resolve`) y `PermissionMatrixIntegrationTest` lo confirmaban, y el dashboard solo consulta `/pending` con `read Priority`; AT ve la alerta con "Ver eventos" en lugar de "Resolver".

- **Fuga encontrada:** con un USUARIO autenticado, `HEAD /api/priority/conflicts/pending` y `HEAD /api/priority/conflicts?eventId=` respondían 200. Spring MVC atiende `HEAD` con el handler `GET`, y el matcher solo restringía `GET`, así que `HEAD` caía en `anyRequest().authenticated()` y el controller ejecutaba la consulta, aunque sin cuerpo. Los métodos sin handler daban 405 en lugar de 403. Lo detectó la revisión con Pi y se confirmó con una sonda descartable.
- **Corrección:** en `SecurityConfig`, después de las reglas específicas, una regla para cualquier método sobre `/api/priority/**` reservada a los tres roles admin, como hizo SEC-03 con `/api/events/**`. Como las reglas específicas se evalúan antes, AT sigue sin poder resolver.
- **Tests (`PriorityConflictAccessIntegrationTest`):**
  - Anónimo y USUARIO reciben 403 en `/pending` y en `/conflicts?eventId=`. Los tres admins reciben 200 con un conflicto real, no solo una página vacía.
  - USUARIO recibe 403 en `HEAD` y `DELETE`; AT puede hacer `HEAD`. Rojo previo: 403 esperado, 200 recibido.
  - El fixture de conflictos pasa de `PriorityConflictDecisionIntegrationTest` a `IntegrationTestBase` (`newPriorityConflict()`).
- **Prueba negativa:** agregar USUARIO a la regla `GET` hace fallar los dos tests de consulta (403 esperado, 200 recibido). Se revirtió.
- **Documentación:** `docs/permisos.md` aclara que `PermissionMatrixIntegrationTest` no evalúa `HEAD`.
- **Revisión con Pi:** `openai/gpt-6.1-sol` y `minimax/MiniMax-M3`, en solo lectura, en dos rondas (la segunda sobre la corrección final, sin hallazgos). `opencode-go/deepseek-v4-pro` no corrió: el proveedor respondió `402 Insufficient account funds`.
  - **Aceptado:** el hueco de `HEAD` y de los métodos sin handler (corregido); `createdAt` del fixture era redundante porque `@PrePersist` lo pisa (quitado).
  - **Al backlog:** el mismo hueco de `HEAD` en `/api/audit/**`, `/api/tech/**` y `/admin/event-requests/**` (la sonda dio 200 o 400 como USUARIO); y las notificaciones de conflicto a un admin degradado a USUARIO. Ver el [backlog](backlog.md#pendientes-detectados-en-la-segunda-iteración-tickets-secreq).
  - **Descartado:** que `requiresRebooking` en `EventResponseDto` exponga conflictos a USUARIO. Es un dato de `event.read`, sin el conflicto ni el evento que lo desplaza.

## SEC-06 — `deciderUserId` obtenido del usuario autenticado

**Estado:** verificado. El hallazgo 1.7 (`43b1093`) quitó `deciderUserId` de `PriorityConflictDecisionRequest` y creó `CurrentUserService`, que resuelve al usuario desde el principal del JWT. `PriorityConflictService.applyDecision` lo obtiene una sola vez y lo usa para `decisionBy`, `lastModifiedBy` del evento desplazado y las auditorías `PRIORITY_CONFLICT` y `SCHEDULE_CHANGE`. Si el cliente manda `deciderUserId`, Jackson lo ignora.

- **Hueco de cobertura:** el test existente solo probaba `KEEP_ORIGINAL` y solo miraba `decisionBy`. `REBOOK_OTHER` también usa al decisor, al modificar el evento y auditar el cambio de agenda, y no tenía test.
- **Test agregado (`PriorityConflictDecisionIntegrationTest`):** AC reubica el evento desplazado con un `deciderUserId` de AF en el body. Verifica que `decisionBy`, `lastModifiedBy` y el actor de las auditorías `PRIORITY_CONFLICT` (cierre) y `SCHEDULE_CHANGE` sean AC, y que el evento haya cambiado de espacio. El principal es AC porque el fixture lo crea AF: un decisor tomado de otro lado no coincide por casualidad.
- **Prueba negativa:** pasar `conflict.getCreatedBy()` a `applyRebooking` en lugar del decisor hace fallar el test (esperado AC, recibido AF). Se revirtió.
- **Revisión con Pi:** `openai/gpt-6.1-sol` y `minimax/MiniMax-M3`, en solo lectura. `opencode-go/deepseek-v4-pro` volvió a responder `402 Insufficient account funds`.
  - **Sin hallazgos:** ningún camino toma al decisor del cliente. Tampoco hay otros endpoints que acepten un ID de actor para acciones auditables: `GET /api/events/user/{userId}` es un filtro, `/api/users/{id}` es el usuario objeto de la acción, y `CreateNotificationDto.userId` es un destinatario interno que ningún controller expone.
  - **Aceptado:** filtrar la auditoría `PRIORITY_CONFLICT` por `toValue == 'CLOSED'`, para que el test no dependa de que el fixture abra el conflicto sin auditar.

## Incidencias de entorno

- **2026-10-17 — Maven falla con `cannot find symbol` en clases con Lombok.** El plugin `jdtls-lsp` de Claude Code lanza Eclipse JDT LS (`jdtls` de Homebrew) sin el agente de Lombok. JDT LS importa el proyecto Maven, genera `.classpath`/`.project`/`.settings` (ignorados por git) y compila en el mismo `target/classes` que Maven. Esas clases salen sin getters, builders ni constructores de Lombok; como son más nuevas que los fuentes, Maven no recompila `main` y falla `testCompile`. Solución inmediata: `./mvnw clean test`. Los errores de Lombok que muestra el editor no son reales.
