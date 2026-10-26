# Backlog de producto y arquitectura

Este documento reúne el estado del sistema para la entrega del TFI y el trabajo que queda. Las rutas y permisos describen el contrato vigente del backend; no implican que ya exista una pantalla para consumirlo.

## Veredicto para la entrega

**El backend está apto para la entrega.** Al 2026-10-26, en `migue/general`, después de la revisión previa a la entrega (REV-01 a REV-21):

- No quedan fallas que rompan un flujo del TFI, fugas de datos ni pérdidas de datos conocidas. Las que aparecieron en la revisión se corrigieron, cada una con un test que fallaba antes del cambio.
- **Suite backend:** 113 de 113 en verde. **E2E sobre MySQL real:** smoke de API 16/16 y Playwright 3/3. Las migraciones V15 a V17 validan contra las entidades.
- Los pendientes de backend que quedan son decisiones abiertas o endurecimientos (concurrencia de refresh, semántica de `KEEP_ORIGINAL`, filtros en servidor). Ninguno impide demostrar el sistema ni contradice el TFI de forma visible.

**Condiciones para entregar:**

1. Llevar `migue/general` a la rama de entrega. `main` todavía tiene fallas P0 corregidas acá.
2. Definir `JWT_SECRET` en el `.env` del entorno de la defensa.
3. Corregir los ocho puntos del texto del TFI listados en "Ajustes al texto del TFI". El más visible es el cambio obligatorio de contraseña en el primer ingreso.

**Frontend:** no fue el foco de esta revisión. Compila y pasa el E2E; sus pendientes están al final del documento.

## Revisión del TODO de hallazgos (segunda pasada)

El TODO original convertía el reporte de errores en un checklist. Esta es la versión revisada contra el código de `migue/general` al 2026-10-26. Cada estado se verificó en el código o en un test, no en el texto del ticket.

**Correcciones al documento original:**

- Se quita la marca `:chatgpt-content-reference{index="0"}` que quedó pegada en la introducción.
- La nota final ("las tareas están inicialmente desmarcadas…") contradecía los P0 y P1 ya marcados. Se reemplaza por el estado verificado.
- `REQ-05` (edición de comentarios) y `CAP-06` (indicador del frontend) son tareas de frontend; se marcan así para no mezclarlas con el backend.
- `QA-01` (P1) y `QA-03` (P3) se superponían. `QA-01` queda como la suite automatizada y `QA-03` como su ejecución final antes de entregar.

### 🔴 P0 — Críticos

- [x] **SEC-01** — El tracking público no expone comentarios internos. `2b509af`, `fb280b3`.
- [x] **SEC-02** — Sin acceso público al listado de solicitudes ni a datos personales. `4a992d4`, `187ac5f`, `002aad7`.
- [x] **SEC-03** — USUARIO no crea, edita ni da de baja eventos. `2d9a04f`, `b8c17b9`.
- [x] **REQ-01** — `requiresTech` se conserva al convertir. `226ca6a`, `33a5b9d`.
- [x] **REQ-02** — `CONVERTIDO` no se presenta como `APROBADO`. `eaf4a8d`, `96dd380`.

### 🟠 P1 — Alta prioridad

- [x] **SEC-04** — Matriz única de permisos entre backend y CASL. `05e11b7`; desde REV-05 también evalúa `HEAD`.
- [x] **SEC-05** — Conflictos pendientes restringidos por rol. `71b4faf`.
- [x] **SEC-06** — `deciderUserId` sale del usuario autenticado. `c872cec`.
- [x] **SEC-07** — DTO de tracking público mínimo. `2b509af`, `87127a4`.
- [x] **API-01** — Soft-delete por `PATCH /api/events/{id}/soft-delete`. `3097d76`.
- [ ] **API-02** — Filtros avanzados del listado de eventos: siguen en el cliente sobre la página cargada (ADR-23 propuesta). Ver pendientes.
- [ ] **API-03** — Bandeja admin paginada: filtra por estado en el servidor pero devuelve una lista completa (ADR-24 propuesta). Ver pendientes.
- [x] **API-04** — Correos por cambio de estado de solicitudes. `141f680`.
- [x] **DB-01** — Carrera en la capacidad técnica. `4551e5a`; REV-15 suma la del espacio físico.
- [x] **QA-01** — Pruebas automatizadas de flujos críticos: suite de integración backend, smoke de API y Playwright.

### 🟡 P2 — Prioridad media

**Solicitudes y eventos**

- [x] **REQ-03** — Motivo de rechazo de solicitudes obligatorio. `5b3734d`, `3e12d70`.
- [x] **REQ-04** — Cambio de contraseña desde el perfil. `0979086`. El TFI dice lo contrario; ver ajustes al texto.
- [x] **REQ-05** — Edición de comentarios en frontend. `4b3ce25`.
- [x] **REQ-06** — Cambio entre `spaceId` y `freeLocation`. `8af6b08`; REV-13 cierra el caso del texto en blanco.
- [x] **REQ-07** — Sugerencias de disponibilidad: se quitaron del contrato. `ac157d9`.
- [x] **REQ-08** — Conformidad técnica siempre obligatoria para `APROBADO`. `7933c8a`.
- [x] **REQ-09** — Estado `SOLICITADO` eliminado. `d0db212`, V13.
- [x] **REQ-10** — `CANCELLED` eliminado de los conflictos. `f00f3e5`.
- [x] **REQ-11** — Revalidación al cambiar buffers o ubicación. `8af6b08`; REV-03 y REV-14 reinician las conformidades.
- [x] **REQ-12** — Motivo de rechazo de eventos obligatorio en backend. `16c466e`.
- [x] **REQ-13** — Eventos pendientes de reprogramación visibles en detalle, listado y dashboard.

**Capacidad y disponibilidad**

- [x] **CAP-01** — La configuración de capacidad se cambia por migración (decisión, ADR-13).
- [ ] **CAP-02** — Una única configuración activa: hoy se resuelve tomando la de mayor `id`; falta la restricción en la base. Ver pendientes.
- [x] **CAP-03** — `technicalSchedule` es informativo (decisión). `7933c8a`.
- [x] **CAP-04** — Buffers que cruzan medianoche. `1505f52`, `f3e1e53`.
- [x] **CAP-05** — La capacidad se valida al completar la aprobación (decisión). `7933c8a`.
- [x] **CAP-06** — Indicador de capacidad del frontend alineado con el backend. `655739e`.
- [x] **CAP-07** — Las ubicaciones libres no validan superposición (decisión, ADR-15).

**Auditoría**

- [x] **AUD-01** — Actor y motivo en el historial de solicitudes. `5b3734d`.
- [x] **AUD-02** — Endpoint administrativo del historial de solicitudes. `5b3734d`.
- [x] **AUD-03** — Los diez tipos de auditoría conectados. `5f25614`.
- [x] **AUD-04** — Auditoría de todos los campos relevantes de eventos. `b4ba03b`.
- [x] **AUD-05** — Soft-delete auditado. `941727b`.
- [x] **AUD-06** — Creación y resolución de conflictos auditadas. `5f25614`.

**Robustez**

- [x] **TECH-01** — Control optimista e idempotencia en transiciones. REV-07 (`5814aab`).
- [ ] **TECH-02** — Fallas de correo: se registran en el log (`WARN`); no hay registro persistente ni monitoreo. Ver pendientes.
- [x] **TECH-03** — `MAIL_MOCK_MODE` por perfil (local y test simulan, docker entrega en Mailpit).

### 🔵 P3 — Validación y cierre del TFI

- [x] **QA-02** — Backend y frontend levantados en un entorno limpio: el runner E2E crea un stack descartable con MySQL vacío.
- [x] **QA-03** — Pruebas de integración y E2E ejecutadas. El 2026-10-26: suite backend 113/113 y E2E sobre MySQL con 16/16 en el smoke de API y 3/3 en Playwright.
- [x] **QA-04** — Flujos de solicitud y aprobación: cubiertos por el smoke de API y por `RequestConversionIntegrationTest`, `EventConformityPermissionsIntegrationTest` y Playwright.
- [x] **QA-05** — Permisos por llamada directa a la API: `PermissionMatrixIntegrationTest` (incluye `HEAD` y anónimo), `UsuarioPermissionsIntegrationTest`, `SessionRevocationIntegrationTest`.
- [x] **QA-06** — Concurrencia y conflictos de agenda: tests de capacidad técnica, espacio, conversión y conformidades simultáneas.
- [x] **QA-07** — Notificaciones y trazabilidad: correos verificados en Mailpit por el E2E; historiales de eventos, solicitudes y cuentas con tests.
- [ ] **DOC-01** — Congelar la versión final: llevar `migue/general` a la rama que se entrega. Ver "Antes de entregar".
- [ ] **DOC-02** — Alinear el texto del TFI con la implementación. Ver "Ajustes al texto del TFI".

**Criterio de finalización:** una tarea se marca cuando la corrección está implementada, el comportamiento se verificó, no genera una regresión conocida y el contrato o la documentación están actualizados.

## Corregido en la revisión previa a la entrega (2026-10-26)

Revisión profunda del backend contra el TFI con siete revisores en paralelo: Claude Opus (trazabilidad TFI ↔ código), Claude Sonnet (tests, E2E y sondas), y Pi con `openai/gpt-6.1-sol`, `openai/gpt-6-astra`, `minimax/MiniMax-M3` y `opencode-go/deepseek-v4-pro`, uno por área. Cada hallazgo se verificó en el código y, cuando correspondía, con un test que fallaba antes del cambio. Detalle en el [registro de cambios](registro-cambios.md#revisión-previa-a-la-entrega).

| ID | Qué se corrigió | Commit |
|---|---|---|
| REV-01 | Los errores de un anónimo llegaban como 403 vacío (login, seguimiento, formulario público); ahora 401/404/400. El contador de intentos fallidos se perdía por rollback. | `d8d239e` |
| REV-02 | Los eventos dados de baja seguían en el calendario interno y la agenda del día. | `326afad` |
| REV-03 | Volver a revisión por una edición conservaba las conformidades; una sola área podía reaprobar. | `e392292` |
| REV-04 | El solicitante anónimo podía elegir prioridad Alta y desplazar eventos ajenos. | `0d04117` |
| REV-05 | `HEAD` ejecutaba controllers de auditoría, capacidad técnica y bandeja como USUARIO. | `dc703db` |
| REV-06 | Dos conversiones simultáneas de una solicitud creaban dos eventos. | `86431d6` |
| REV-07 | Ceremonial y Técnica aprobando a la vez perdían una conformidad; sin control optimista (TECH-01). | `5814aab` |
| REV-08 | Se aceptaban departamentos dados de baja (RF-14). | `eec78fd` |
| REV-09 | Las acciones sobre cuentas no dejaban rastro (CU-02, RNF-05). | `1f37437` |
| REV-10 | Tests de conformidades por área, JWT inválido o vencido y administración de cuentas. | `36df3e0` |
| REV-11 | La clave JWT por defecto estaba publicada en el repositorio. | `799d64d` |
| REV-12 | El rol salía del token: un admin degradado conservaba permisos. El reset no cortaba sesiones; la revocación del refresh se perdía por rollback. | `0126d3b` |
| REV-13 | Un `freeLocation` en blanco dejaba el evento sin ubicación; un espacio dado de baja bloqueaba a sus eventos; se podían editar eventos dados de baja. | `467a946` |
| REV-14 | Reubicar por conflicto de prioridad dejaba el evento aprobado con conformidades viejas y sin avisar. | `98d12ef` |
| REV-15 | Dos reservas simultáneas del mismo espacio quedaban las dos confirmadas. | `7fc83bd` |
| REV-16 | Una cuenta degradada a USUARIO seguía leyendo extractos de comentarios internos en sus notificaciones. | `502a181` |
| REV-17 | README institucional en la raíz (RNF-08). | `94effd5` |

**Revisión cruzada.** Los commits REV-01 a REV-16 se revisaron de nuevo con tres modelos distintos al autor (`openai/gpt-6.1-sol`, `minimax/MiniMax-M3`, `opencode-go/deepseek-v4-pro`). Encontraron seis problemas reales en esos arreglos, corregidos en:

| ID | Qué se corrigió | Commit |
|---|---|---|
| REV-18 | La edición tomaba la capacidad antes que el evento y la transición al revés: podían quedar en deadlock (500). Orden de bloqueo único, conflicto bloqueado al decidir y deadlocks como 409. | `f949992` |
| REV-19 | Una conformidad parcial dada en `EN_REVISION` sobrevivía a un cambio de agenda. Reenviar el espacio actual dado de baja daba 404. | `386abcd` |
| REV-20 | Un token anterior a un restablecimiento volvía a valer cuando el titular definía su contraseña. | `de9ba08` |
| REV-21 | El contador de intentos fallidos perdía incrementos concurrentes; `markAsRead` no aplicaba el filtro de REV-16. | `6498888` |

## Antes de entregar

- [ ] **Llevar `migue/general` a la rama de entrega.** El TFI (7.9.1) dice que se entrega desde la rama principal. `main` está 111 commits atrás y conserva fallas P0 ya corregidas, como `GET /public/event-requests` público. Además, `origin/main` tiene 11 commits propios (README, correo, selector de hora y formularios). Al integrar, conservar el `SecurityConfig` y el README de `migue/general`, y correr la suite y el E2E sobre el resultado.
- [ ] **Generar la clave JWT del entorno de la defensa** (`openssl rand -hex 32` en `.env`). Sin ella, el backend no arranca (ADR-28).
- [ ] **Aplicar los ajustes al texto del TFI** de la sección siguiente.

## Ajustes al texto del TFI

El código y el TFI dicen cosas distintas en estos puntos. En todos, la recomendación es corregir el texto, porque el comportamiento del código es el decidido.

| Dónde (línea de la exportación) | Qué dice el TFI | Qué hace el sistema | Texto sugerido |
|---|---|---|---|
| RF-01 (567), 7.3 (1204), 7.8.2 (1403), CU-01 (846) | El usuario ingresa con la contraseña enviada "sin un paso obligatorio de cambio personal". | Una cuenta nueva o restablecida debe definir su contraseña al primer ingreso; hasta entonces solo puede cambiarla (REQ-04). | "Al primer ingreso, y después de un restablecimiento, el sistema solicita definir una contraseña propia antes de operar." |
| 7.4.2 (1227), 7.4.3 (1242), RN-12 (758) | El motivo administrativo del rechazo "no se publica automáticamente". | El motivo del rechazo de la **solicitud** se muestra en el seguimiento y en el correo. El del **evento** y las observaciones internas nunca se publican (ADR-18). | "El motivo del rechazo de la solicitud se comunica al solicitante por correo y en el seguimiento. Los motivos del evento y las observaciones internas no se publican." |
| CU-07, flujo alternativo (971) | "…o falta capacidad técnica requerida, se impide registrar la Solicitud". | La solicitud no declara soporte técnico. El área lo define al convertir y recién ahí se valida la capacidad (ADR-12). | Quitar "o falta capacidad técnica requerida". |
| 7.2 y Tabla 7.2 (1195, 1377) | MailHog. | Mailpit, el reemplazo mantenido de MailHog; cumple la misma función. | Reemplazar "MailHog" por "Mailpit". |
| 7.10.1 (1427) | Pruebas generales de inicio, "no cobertura automatizada de las reglas". | Hay una suite de integración que cubre las reglas de negocio, más el smoke de API y Playwright sobre un stack descartable. | Describir la suite automatizada; ver pendiente de pruebas sistemáticas. |
| RF-12 y 6.1 | AT figura con "intervenir conflictos"; no se menciona la resolución por API. | AF y AC resuelven por `POST /api/priority/decisions`; AT consulta (ADR-16). | Aclarar que AT consulta y que la resolución se opera por API, sin pantalla. |
| RF-15 (609), 7.6.1 (1303) | "Los filtros deben acotar efectivamente los resultados." | Los filtros del listado se aplican en el cliente sobre la página cargada (API-02 pendiente). | Implementar API-02 o describir el alcance real. |
| RNF-03 (646) | El público no ve identificadores internos. | El calendario público expone el `id` técnico del evento (el cliente lo usa como clave). | "…sin identificadores administrativos; el calendario conserva una clave técnica del evento." |

## Pendientes

Ordenados por impacto. Ninguno rompe un flujo en operación normal; los de backend son endurecimientos o decisiones abiertas.

### Backend

#### Refresh concurrente del mismo token

Dos renovaciones simultáneas con el mismo refresh token leen `revoked=false` y emiten dos sucesores válidos; la detección de reutilización solo funciona si son secuenciales. Bloquear el token con `PESSIMISTIC_WRITE` lo cierra, pero el frontend tiene dos coordinadores de refresh (`lib/http.ts` y `services/api/client/interceptors.ts`) y dos pestañas pueden renovar a la vez: con un bloqueo estricto, el usuario legítimo quedaría deslogueado.

- [ ] Unificar el refresh del frontend en un solo coordinador.
- [ ] Bloquear el token al validarlo y admitir un período de gracia corto (unos segundos) en el que la reutilización de un token recién rotado devuelve 401 sin revocar toda la familia. Agregar unicidad sobre `rotated_from` y un test concurrente.

#### Doble ocupación mientras un conflicto de prioridad está abierto (decisión abierta)

Un evento de prioridad Alta pasa a `RESERVADO` sobre un espacio que ocupa otro de prioridad menor, y los dos quedan comprometidos hasta que se resuelve el conflicto. Es lo que dice RN-09 ("esa marca no modifica por sí sola fecha, horario, espacio ni estado del afectado"). Con `KEEP_ORIGINAL`, en cambio, la doble ocupación queda definitiva: se cierra el conflicto sin mover a nadie.

- [ ] Decidir qué significa `KEEP_ORIGINAL`. Opciones: (a) conservar al desplazado y devolver el evento Alto a `EN_REVISION`; (b) aceptar la doble ocupación como decisión administrativa explícita y documentarla en el TFI. Registrar como ADR.

#### Conversión de una solicitud con un departamento dado de baja (decisión)

`convertToEvent` copia el departamento de la solicitud aunque se haya dado de baja después de recibirla. Hoy se trata como una relación existente, igual que un evento que ya tenía ese departamento (ADR-34), y no como una asignación nueva. El espacio, en cambio, sí se revalida al convertir porque bloquea ocupación.

- [ ] Confirmar el criterio o exigir un departamento vigente al convertir (con un body opcional para reasignarlo).

#### Reversión manual a revisión con conformidades vigentes (decisión abierta)

`POST /api/events/{id}/status` con `{"to":"EN_REVISION"}` desde `RESERVADO` o `APROBADO` solo baja las conformidades que el pedido baja explícitamente (`EventStatusService.handleReversion`). Si no se baja ninguna, el evento queda en revisión con las dos en `true` y cualquier admin lo reaprueba sin que las áreas reevalúen. La edición y la reubicación ya las reinician (ADR-25); la reversión manual no, porque reiniciarlas haría que un área retire la conformidad de la otra, cosa que hoy está prohibida.

- [ ] Decidir: (a) la reversión manual reinicia ambas como regla del sistema, no como acción de un área; o (b) se conservan y se documenta que "volver a revisión" sin bajar conformidades no exige reevaluar. Registrar la decisión como ADR.

#### Código de conflicto de prioridad sin serializar

`PriorityConflictService.registerConflicts` calcula el número del código (`PRIO-yyyyMMdd-#####`) con `countByDate`, sin bloqueo. Dos eventos de prioridad Alta que desplazan ocupantes en la misma fecha, al mismo tiempo y en espacios distintos, pueden generar el mismo código. La segunda operación falla con 409 "Entity already exists" y se revierte entera.

- [ ] Generar el código con una secuencia atómica o reintentar ante la colisión, y mapearla a un mensaje propio.

#### Filtros del listado de eventos en el servidor (API-02, ADR-23)

`GET /api/events` solo acepta `page`, `size` y `sort`; los filtros se aplican en el cliente sobre la página cargada y dan resultados incompletos con más de una página.

- [ ] `Specification` con `q`, `status[]`, `priority[]`, `dateFrom`/`dateTo`, `spaceId[]`, `departmentId[]`, `internal` y `requiresTech`, siempre sin los eventos dados de baja. Dos commits, backend y frontend.

#### Bandeja de solicitudes paginada (API-03, ADR-24)

- [ ] `GET /admin/event-requests` devuelve `Page` con `page`, `size`, `sort`, `status[]`, `q`, `dateFrom` y `dateTo`; adaptar `publicRequests.api.ts` y su store.

#### Una sola configuración de capacidad activa en la base (CAP-02)

Hoy, si quedan dos activas, gana la de mayor `id`. Si no hay ninguna, `TechCapacityService.lockActiveConfig` usa un valor por defecto en memoria, sin bloqueo.

- [ ] Restricción única sobre la configuración activa (en MySQL, índice único sobre una columna generada) y una configuración inicial garantizada por migración.

#### Registro persistente de fallas de correo (TECH-02)

- [ ] Guardar cada falla de entrega (destinatario, tipo, agregado, error) en una tabla consultable por ADMIN_FULL, además del `WARN` en el log.

#### Línea temporal pública con hitos duplicados

Una edición de agenda registra `REPROGRAM` y `SCHEDULE_CHANGE`, y el seguimiento público muestra los dos como "cambio de agenda". Una reversión manual sin cambio de agenda también registra `REPROGRAM`.

- [ ] Registrar un solo hito por hecho y `REPROGRAM` solo si cambió la agenda.

#### Pruebas sistemáticas

La cobertura actual verifica cada regla con tests de integración, pero no hay una trazabilidad formal requerimiento → prueba ni pruebas de carga.

- [ ] Tabla RF/RNF/RN del TFI → test que lo verifica, en el repositorio, y completar los casos que falten.
- [ ] Test del rechazo por capacidad técnica al convertir (ver segunda iteración).
- [ ] Validaciones del formulario público (400 por campo) y transiciones inválidas de evento.
- [ ] Correos de cambio de estado del evento y alta y edición de catálogos.
- [ ] Una prueba de carga básica sobre reserva y aprobación concurrentes contra MySQL.

### Frontend

- [ ] Dejar de enviar `priority` en la solicitud pública (`publicRequests.api.ts`); el backend lo ignora desde REV-04.
- [ ] Mostrar el 409 `CONCURRENT_MODIFICATION` con un mensaje para recargar el registro (REV-07).
- [ ] Pantalla del historial de una cuenta con `GET /api/users/{id}/history` (REV-09).
- [ ] Schemas Zod de eventos desalineados (ver segunda iteración).
- [ ] Pantalla de resolución de conflictos de prioridad (ver sección propia).


## Pendientes detectados en la segunda iteración (tickets SEC/REQ)

Hallazgos que aparecieron al cerrar tickets de la segunda iteración y quedaron fuera de su alcance. Se toman en la tercera iteración. Cada uno indica el ticket donde surgió; el detalle está en el [registro de cambios](registro-cambios.md).

### Schemas Zod de eventos desalineados con el backend (surgió en REQ-02)

`frontend/src/services/api/utils/validation-schemas.ts` declara `EventStatusSchema = ['APROBADO', 'CANCELADO', 'PENDIENTE', 'RECHAZADO', 'REPROGRAMADO']`, pero el backend (`Status.java`) solo tiene `EN_REVISION`, `RESERVADO`, `APROBADO` y `RECHAZADO`. Lo usan `changeEventStatusSchema`, `eventFiltersSchema` y el agregado `ValidationSchemas`. Al 2026-10-19, de ese módulo solo se consume `emailSchema` (`src/schemas/eventPublic.schema.ts`); el resto se reexporta desde los barrels (`services/api/index.ts`, `services/api/utils/index.ts`) sin uso.

- [ ] Volver a buscar consumidores y registrar el resultado.
- [ ] Si siguen sin uso: eliminar los schemas muertos y sus reexportaciones, y conservar `emailSchema`. Si aparece un consumidor: alinear `EventStatusSchema` con `Status.java` y revisar los schemas que dependen de él.
- [ ] `tsc -b`, build y lint sin errores nuevos en los archivos tocados.

### Test del rechazo por capacidad técnica al convertir (surgió en REQ-01)

`EventRequestService.convertToEvent` rechaza la conversión con `requiresTech=true` si no hay capacidad técnica en el rango (`TechCapacityExceededException`). `RequestConversionIntegrationTest` solo cubre la conversión con soporte y sin body.

- [ ] Test de integración (extiende `IntegrationTestBase`): con la capacidad técnica agotada en el rango, la conversión con `requiresTech=true` responde error, no crea el evento y la solicitud no pasa a `CONVERTIDO`.

### ~~Test de las reglas de permisos que aplican los servicios~~ (surgió en SEC-04) — resuelto en REV-10

`PermissionMatrixIntegrationTest` verifica las filas con endpoints, pero no las que aplican los servicios: `event.approveCeremonial` y `event.approveTechnical` (`EventStatusService`, `CEREMONIAL_ONLY`/`TECHNICAL_ONLY`). Hoy ningún test cubre esos 403.

- [x] Test de integración (extiende `IntegrationTestBase`): en `POST /api/events/{id}/status`, AC no puede cambiar `technicalOk`, AT no puede cambiar `ceremonialOk` (403) y AF puede cambiar ambos; los roles salen de las filas de `permisos.json` o se contrastan con ellas.

### ~~`HEAD` en rutas admin restringidas solo por `GET`~~ (surgió en SEC-05) — resuelto en REV-05

Spring MVC atiende `HEAD` con el handler `GET`, pero los matchers de `SecurityConfig` con `HttpMethod.GET` no lo cubren, así que `HEAD` cae en `anyRequest().authenticated()`. Una sonda del 2026-10-24 dio, como USUARIO: `HEAD /api/audit/1` → 200, `HEAD /admin/event-requests` → 200, `HEAD /api/tech/capacity` → 400 (pasa la seguridad y falla el binding). No devuelve cuerpo, pero el controller se ejecuta para un rol sin permiso. El anónimo recibe 403. SEC-05 lo cerró solo para `/api/priority/**`; `/api/events/**` ya lo cubría desde SEC-03.

- [x] Cerrar `HEAD` (y los métodos sin handler) en `/api/audit/**`, `/api/tech/**` y `/admin/event-requests/**`, con una regla para cualquier método o con un criterio general en `SecurityConfig`.
- [x] Que `PermissionMatrixIntegrationTest` evalúe también `HEAD` para cada endpoint `GET` de la matriz, para que el caso no dependa de tests sueltos.

### ~~Notificaciones de conflicto a un usuario degradado a USUARIO~~ (surgió en SEC-05) — resuelto en REV-16

`NotificationEventListener` notifica el conflicto de prioridad al creador del evento desplazado sin mirar su rol, y la notificación nombra ambos eventos. Hoy los eventos los crean admins, pero si AF degrada a ese admin a USUARIO (`UserAdminService`), sigue leyendo esas notificaciones y recibe nuevas. No permite listar conflictos ajenos.

- [x] Decidir si la notificación se filtra por rol al enviarla o al leerla (se filtra en ambos momentos, ADR-32), o si se acepta como aviso al responsable del evento; registrar la decisión en `docs/decisiones-funcionales.md`.

## Resolver conflictos de prioridad

**Objetivo:** permitir que los roles autorizados revisen conflictos abiertos y resuelvan uno conservando el evento original o reubicando el evento desplazado.

### Contrato existente

| Acción | Endpoint | Acceso efectivo | Entrada y salida |
|---|---|---|---|
| Consultar conflictos pendientes | `GET /api/priority/conflicts/pending` | `ADMIN_FULL`, `ADMIN_CEREMONIAL` y `ADMIN_TECNICA` | Responde una página de `PendingPriorityConflictResponse`: `conflictId`, `highEventId`, `displacedEventId`, `spaceId`, `date`, `from`, `to`, `priorityHigh`, `priorityDisplaced`, `requiresRebooking`, `createdAt` y `createdByUserId`. La página usa orden descendente por `createdAt` por defecto. |
| Resolver un conflicto | `POST /api/priority/decisions` | Solo `ADMIN_FULL` y `ADMIN_CEREMONIAL` | JSON `{"conflictId":"…","decision":"REBOOK_OTHER"|"KEEP_ORIGINAL","target":{"date":"yyyy-MM-dd","from":"HH:mm","to":"HH:mm","spaceId":1},"reason":"…"}`. `target` es opcional para el DTO, pero requerido por el servicio al elegir `REBOOK_OTHER`; `reason` es opcional. Responde `conflictId`, `decision` y `status` (HTTP 201). |

La consulta acepta los parámetros estándar de `Pageable` (`page`, `size`, `sort`); la respuesta es `Page<PendingPriorityConflictResponse>` con `content` y metadatos de página como número, tamaño y totales. Si no se envía `sort`, el controller usa `createdAt,DESC`.

El cliente nunca envía el usuario decisor: el servicio usa la identidad autenticada. `REBOOK_OTHER` valida disponibilidad y capacidad técnica aplicables; no se debe presentar la reubicación como confirmada hasta recibir respuesta exitosa. Un conflicto cerrado responde 409; un conflicto inexistente, 404. `KEEP_ORIGINAL` cierra el conflicto sin cambiar fecha/espacio del evento desplazado y desactiva `requiresRebooking`.

### Criterios de hecho

- [ ] La pantalla obtiene y pagina los conflictos pendientes mediante el endpoint existente; muestra fecha, horario, espacio, eventos/prioridades e indicador de reubicación requerida sin inferir campos que la API no devuelve.
- [ ] Solo `ADMIN_FULL` y `ADMIN_CEREMONIAL` ven/pueden ejecutar acciones de resolución; `ADMIN_TECNICA` conserva acceso de lectura. La UI usa CASL como control de presentación y el backend sigue siendo la autoridad.
- [ ] `KEEP_ORIGINAL` envía únicamente `conflictId` y `decision` (más `reason` solo si se captura) y refresca el listado ante éxito.
- [ ] `REBOOK_OTHER` solicita fecha, hora inicial/final y espacio; envía `target` con los nombres y formatos exactos del DTO. No permite enviar `deciderUserId`.
- [ ] Se muestran errores observables del backend para conflicto cerrado, inexistente, disponibilidad/capacidad y validación, sin retirar el conflicto del listado como si se hubiera resuelto.
- [ ] Pruebas cubren visualización por permisos, ambas decisiones, target ausente para `REBOOK_OTHER`, error del servidor y actualización tras éxito; los tests backend de acceso existentes continúan verdes.

**Fuentes:** `PriorityConflictController`, `PendingPriorityConflictResponse`, `PriorityConflictDecisionRequest`, `PriorityConflictDecisionResponse`, `PriorityConflictService`, `SecurityConfig`, `PriorityConflictAccessIntegrationTest`, `docs/permisos.md` y `docs/decisiones-funcionales.md`.

## Pagar deuda de límites entre módulos

Seguir este orden, que prioriza propiedad de escrituras antes de reubicar eventos y restringir acceso a repositorios. En cada tramo, inspeccionar consumidores actuales, mover una operación al servicio dueño cuando corresponda, actualizar `docs/arquitectura.md`, añadir pruebas del comportamiento/límite y retirar solo la arista que ya no tenga consumidores. No convertir las dependencias actuales en excepciones silenciosas.

1. **Escrituras ajenas (primero).** Mover las escrituras directas de `EventRequestService` sobre `Event`, `EventHistory` y `EventRequestHistory`, y de `PriorityConflictService` sobre `Event`, a operaciones transaccionales del módulo dueño. Preservar auditoría, estado y atomicidad.
2. **Eventos junto a sus publicadores (segundo).** Mover los contratos actualmente declarados en `feature/notifications/event` a `feature/<publisher>/event` para `comments`, `events`, `priority` y `requests`. Transportar IDs/datos escalares, no entidades JPA; mantener los efectos post-commit con `@TransactionalEventListener(AFTER_COMMIT)`. Revisar explícitamente `PriorityConflictEvent`, cuyo listener no se observa en el estado documentado, antes de decidir si se elimina o se agrega consumidor.
3. **Repositorios ajenos (tercero).** Retirar inyecciones/uso externo de repositorios privados y reemplazarlos por operaciones/consultas de servicios dueños o contratos explícitos. Verificar el inventario completo en el código al iniciar cada lote; los ejemplos actuales incluyen `CustomUserDetailsService`, `AvailabilityService`, `EventService`, `EventRequestService`, `PriorityConflictService` y componentes de notificaciones.

### Criterios de hecho por tramo

- [ ] No quedan escrituras directas fuera del módulo dueño para las tablas cubiertas por el tramo; tests prueban el estado/auditoría esperado y la atomicidad relevante.
- [ ] Los eventos movidos viven en el paquete `event` del publisher, tienen payload estable sin entidades JPA y sus listeners conservan semántica post-commit; el caso sin listener tiene decisión explícita y prueba/documentación coherente.
- [ ] No quedan imports/inyecciones ajenos a `feature.*.repository` fuera del módulo propietario para las clases cubiertas; las operaciones mantienen resultados y permisos observables.
- [ ] Se actualizan el mapa/deuda de `docs/arquitectura.md` y las listas de `ModuleBoundariesTest` al retirar aristas; las pruebas existentes y los tests de módulo afectado pasan.

**Estado de la guarda:** C1 está resuelto. `ModuleBoundariesTest` aplica y verifica las cuatro reglas ArchUnit documentadas en [Arquitectura](arquitectura.md#guardianes): aristas exactas entre módulos, usos exactos de repositorios ajenos, dependencias de controllers con las dos excepciones ya previstas, y clases exactas en `feature.notifications.event`. `PriorityConflictController` delega ahora en `PriorityConflictService`; se conserva el contrato existente de `EventService.getOpenConflicts`, que devuelve entidades. Las sondas negativas confirmaron fallos para las dependencias prohibidas y se revirtieron; no se agregó ninguna allowlist.

**Fuentes:** sección [Deuda](arquitectura.md#deuda) y reglas vigentes de [Arquitectura](arquitectura.md); los nombres y ejemplos son inventario documentado y deben contrastarse con los imports/consumidores actuales al tomar cada tarea.

## Actualizar `synthetic-user-engine` (condicional)

El motor sintético local está ignorado/no versionado y su contrato fue identificado como antiguo. No actualizar ni publicar esa carpeta como parte automática de este backlog. Primero decidir explícitamente si se versionará y cuál será su dueño/fuente de contrato. Si se decide versionarlo, actualizarlo contra endpoints, roles y payloads actuales documentados y verificar sus escenarios contra el backend vigente; si no se versiona, mantenerlo fuera del alcance y no tratarlo como evidencia de compatibilidad.

### Criterios de hecho si se aprueba versionarlo

- [ ] Hay una decisión registrada sobre versionado, ubicación y mantenimiento antes de tocar los artefactos locales.
- [ ] El motor consume solo contratos vigentes contrastados con controllers/DTOs y `SecurityConfig`; no reproduce payloads/roles obsoletos.
- [ ] Sus escenarios se ejecutan contra el backend de prueba actual y el resultado queda registrado. La prueba del motor no sustituye tests de integración backend ni E2E.

**Dependencia:** decisión de versionado pendiente; hasta entonces no hay tarea de implementación aprobada.
