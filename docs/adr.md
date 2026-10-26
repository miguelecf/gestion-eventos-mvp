# Registro de decisiones (ADR)

Cada decisión de arquitectura y de negocio del TFI tiene una entrada en este documento: qué se decidió, por qué y qué consecuencias tiene. El detalle operativo sigue en [decisiones funcionales](decisiones-funcionales.md), [arquitectura](arquitectura.md) y [permisos](permisos.md); este registro los conecta y conserva el motivo. Sirve como fuente para los capítulos de diseño y decisiones del informe final.

## Cómo leerlo

- **Estado:** `vigente` (rige hoy), `propuesta` (acordada, sin implementar), `reemplazada` (indica por cuál).
- **Origen:** el hallazgo del reporte de errores (`1.1`, `2.3`…), el ítem del plan de trabajo (`C1`, `D2`…) o el ticket (`SEC-xx`, `REQ-xx`, `API-xx`, `REV-xx`) que la motivó, con el commit que la implementa.
- **Fecha:** la del commit que la implementó o documentó por primera vez.
- Una decisión no se edita para cambiarla. Se agrega una entrada nueva y la anterior pasa a `reemplazada`.

## Índice

| ADR | Decisión | Estado | Fecha | Origen |
|---|---|---|---|---|
| [01](#adr-01) | Monolito modular con fronteras verificadas por tests | vigente | 2026-10-04 | C1, C2 |
| [02](#adr-02) | La deuda de módulos se congela, no se refactoriza | vigente | 2026-10-04 | C1 |
| [03](#adr-03) | El backend autoriza; CASL solo presenta | vigente | 2026-10-01 | 1.5 |
| [04](#adr-04) | Matriz única de permisos en un JSON versionado | vigente | 2026-10-19 | SEC-04 |
| [05](#adr-05) | Las rutas admin cierran con una regla para cualquier método | reemplazada por 26 | 2026-10-19 | SEC-03, SEC-05 |
| [06](#adr-06) | El actor de una acción sale del usuario autenticado | vigente | 2026-10-01 | 1.7, SEC-06 |
| [07](#adr-07) | USUARIO consulta y solicita; no gestiona eventos | vigente | 2026-10-01 | 1.4 |
| [08](#adr-08) | Contratos públicos con DTOs mínimos propios | vigente | 2026-10-01 | 1.1, 1.3, SEC-02 |
| [09](#adr-09) | Solicitud y evento tienen ciclos de vida distintos | vigente | 2026-10-01 | 2.1, REQ-02 |
| [10](#adr-10) | Aprobar exige conformidad ceremonial y técnica | vigente | 2026-10-01 | 3.1 |
| [11](#adr-11) | Las conformidades se guardan por separado; la agenda se valida al bloquear | vigente | 2026-10-01 | 3.9 |
| [12](#adr-12) | El área define el soporte técnico al convertir | vigente | 2026-10-01 | 3.2, REQ-01 |
| [13](#adr-13) | Capacidad técnica: configuración por migración y consumo serializado | vigente | 2026-10-01 | 3.5, 3.6, 5.2, 5.3 |
| [14](#adr-14) | Editar agenda o ubicación de un evento bloqueante lo devuelve a revisión | reemplazada por 25 | 2026-10-01 | 2.9, 3.7 |
| [15](#adr-15) | La ubicación libre no es un recurso exclusivo | vigente | 2026-10-01 | 6.1 |
| [16](#adr-16) | Conflictos de prioridad: tres roles consultan, dos resuelven, por API | vigente | 2026-10-01 | 1.6, 1.7-bis, 3.4 |
| [17](#adr-17) | Baja lógica auditada, por `PATCH`, en cualquier estado | vigente | 2026-10-01 | 2.2, 3.3-bis, 4.5 |
| [18](#adr-18) | Motivo de rechazo: público en la solicitud, interno en el evento | vigente | 2026-10-01 | 2.5, 2.6, 6.3 |
| [19](#adr-19) | Los rechazos por conflicto no se auditan | vigente | 2026-10-01 | 4.3 |
| [20](#adr-20) | Correos después del commit; una falla no revierte la operación | vigente | 2026-10-01 | 2.5, 5.5 |
| [21](#adr-21) | Migraciones Flyway inmutables | vigente | 2026-10-03 | D2 |
| [22](#adr-22) | Filtros del listado de eventos en el cliente | reemplazada por 23 | 2026-10-01 | 2.3 |
| [23](#adr-23) | Filtros del listado de eventos en el servidor | propuesta | 2026-10-24 | API-02 |
| [24](#adr-24) | Bandeja de solicitudes paginada en el servidor | propuesta | 2026-10-24 | API-03 |
| [25](#adr-25) | Toda modificación relevante de un evento reinicia su revisión | vigente | 2026-10-26 | REV-03, REV-14, REV-19 |
| [26](#adr-26) | Las lecturas cubren GET y HEAD; los prefijos admin cierran sin método | vigente | 2026-10-26 | REV-05 |
| [27](#adr-27) | 401 sin autenticación, 403 sin permiso, y /error público | vigente | 2026-10-26 | REV-01 |
| [28](#adr-28) | La clave de firma JWT es obligatoria y propia de cada entorno | vigente | 2026-10-26 | REV-11 |
| [29](#adr-29) | Los permisos salen del rol vigente; el restablecimiento corta sesiones | vigente | 2026-10-26 | REV-12, REV-20 |
| [30](#adr-30) | Las transiciones se serializan por fila, en un orden único, y las ediciones viejas fallan | vigente | 2026-10-26 | REV-06, REV-07, REV-15, REV-18 |
| [31](#adr-31) | La solicitud pública no define la prioridad | vigente | 2026-10-26 | REV-04 |
| [32](#adr-32) | Las notificaciones internas son solo para cuentas administrativas | vigente | 2026-10-26 | REV-16 |
| [33](#adr-33) | Las acciones sobre cuentas internas se auditan | vigente | 2026-10-26 | REV-09 |
| [34](#adr-34) | Un catálogo dado de baja no se asigna, pero no bloquea lo existente | vigente | 2026-10-26 | REV-08, REV-13 |
| [35](#adr-35) | El motor de usuarios sintéticos se versiona y verifica la app por HTTP | vigente | 2026-10-26 | REV-24 |

## Arquitectura

<a id="adr-01"></a>

### ADR-01 · Monolito modular con fronteras verificadas por tests

**Estado:** vigente · **Fecha:** 2026-10-04 · **Origen:** C1 (`5e5de2d`), C2 (`302366d`)

**Contexto.** El backend es un solo despliegue Spring Boot sobre una base MySQL compartida. Los paquetes `feature/*` se pensaron como módulos "tipo microservicios", pero nada impedía que un módulo usara el repositorio o el controller de otro.

**Decisión.** Se mantiene un monolito modular. Cada módulo es dueño de sus tablas y escrituras, y los demás le piden operaciones a su servicio. Las fronteras se verifican con ArchUnit en el backend y con zonas de import de ESLint en el frontend.

**Consecuencias.** Una dependencia nueva entre módulos rompe `ModuleBoundariesTest` hasta que se actualiza el mapa de [arquitectura](arquitectura.md). Las relaciones JPA entre módulos siguen permitidas porque hay un solo contexto de persistencia, pero no habilitan a escribir la tabla ajena.

**Se verifica en:** `ModuleBoundariesTest`, `frontend/eslint.config.js`.

<a id="adr-02"></a>

### ADR-02 · La deuda de módulos se congela, no se refactoriza

**Estado:** vigente · **Fecha:** 2026-10-04 · **Origen:** C1 (`5e5de2d`)

**Contexto.** Al trazar el mapa aparecieron escrituras ajenas (`EventRequestService` escribe `Event`), repositorios inyectados entre módulos, ciclos de imports y un `shared` que depende de excepciones de features.

**Decisión.** La deuda observada queda registrada y congelada en los conjuntos exactos de `ModuleBoundariesTest`. Esta etapa del TFI no la refactoriza.

**Consecuencias.** La deuda no puede crecer sin que falle un test, y su orden de pago queda documentado en [arquitectura § Deuda](arquitectura.md#deuda). El costo es convivir con ciclos conocidos, por ejemplo `events↔requests`.

## Seguridad y permisos

<a id="adr-03"></a>

### ADR-03 · El backend autoriza; CASL solo presenta

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgo 1.5 (`e5b4881`)

**Contexto.** `ability.ts` le daba a USUARIO `update`/`delete` sobre eventos que el backend rechazaba, y el dashboard le disparaba consultas que respondían 403.

**Decisión.** `SecurityConfig`, y los servicios donde haga falta, son la única autoridad. CASL decide qué se muestra en la interfaz y nunca reemplaza un control del servidor.

**Consecuencias.** Un permiso faltante en CASL degrada la interfaz, pero no abre datos. Un permiso de más en CASL muestra un botón que termina en 403.

<a id="adr-04"></a>

### ADR-04 · Matriz única de permisos en un JSON versionado

**Estado:** vigente · **Fecha:** 2026-10-19 · **Origen:** SEC-04 (`05e11b7`)

**Contexto.** Había tres copias de los permisos que se alineaban a mano: la tabla de `docs/permisos.md`, `SecurityConfig` y `ability.ts`. El hallazgo 1.5 salió de esa desalineación.

**Decisión.** `frontend/src/libs/permisos.json` es la fuente única. `ability.ts` arma CASL desde la matriz, y `PermissionMatrixIntegrationTest` la contrasta con los controllers, `SecurityConfig` y los `@PreAuthorize`. El archivo vive en `frontend/` porque la imagen Docker del frontend solo copia esa carpeta.

**Consecuencias.** Un endpoint nuevo sin fila en la matriz rompe el test. `ADMIN_FULL` pierde el `manage all` y recibe sus filas explícitas. El test no cubre las reglas que aplican los servicios ni `HEAD`, y esos límites están escritos en [permisos](permisos.md).

<a id="adr-05"></a>

### ADR-05 · Las rutas admin cierran con una regla para cualquier método

**Estado:** reemplazada por [ADR-26](#adr-26) · **Fecha:** 2026-10-19 · **Origen:** SEC-03 (`b8c17b9`), SEC-05 (`71b4faf`)

**Contexto.** Las reglas de `SecurityConfig` se escribían por método. Un `PUT` o `DELETE` sobre `/api/events/**` caía en `anyRequest().authenticated()`, y `HEAD` sobre `/api/priority/**` respondía 200 a USUARIO, porque Spring MVC lo atiende con el handler `GET`.

**Decisión.** Después de las reglas específicas, cada prefijo admin termina con una regla sin método que lo reserva a los roles admin. Las reglas específicas se evalúan antes, así que AT sigue sin poder resolver conflictos.

**Consecuencias.** Un endpoint futuro bajo esos prefijos nace cerrado. `/api/audit/**`, `/api/tech/**` y `/admin/event-requests/**` tenían el mismo hueco de `HEAD`; lo cerró [ADR-26](#adr-26).

<a id="adr-06"></a>

### ADR-06 · El actor de una acción sale del usuario autenticado

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgo 1.7 (`43b1093`), SEC-06 (`c872cec`)

**Contexto.** `PriorityConflictDecisionRequest` recibía `deciderUserId` desde el cliente, así que cualquiera podía decidir un conflicto en nombre de otro usuario y la auditoría registraba a ese otro.

**Decisión.** Ningún endpoint acepta el ID del actor de una acción auditable. `CurrentUserService` lo resuelve desde el principal del JWT.

**Consecuencias.** `decisionBy`, `lastModifiedBy` y el actor de las auditorías son siempre el principal. Si el cliente manda `deciderUserId`, Jackson lo ignora.

**Se verifica en:** `PriorityConflictDecisionIntegrationTest`.

<a id="adr-07"></a>

### ADR-07 · USUARIO consulta y solicita; no gestiona eventos

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgo 1.4 (`2d9a04f`)

**Contexto.** USUARIO podía crear, editar y dar de baja eventos por API.

**Decisión.** USUARIO lee eventos y catálogos, y los catálogos los necesita para los filtros del listado. Crea **solicitudes** desde el formulario público, igual que cualquier visitante. La creación, edición y baja de eventos queda para los roles admin.

**Consecuencias.** Todo evento pasa por el circuito de revisión de una solicitud o lo crea un admin.

**Se verifica en:** `UsuarioPermissionsIntegrationTest`.

<a id="adr-08"></a>

### ADR-08 · Contratos públicos con DTOs mínimos propios

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgos 1.1 y 1.3 (`2b509af`), SEC-02 (`187ac5f`, 2026-10-17)

**Contexto.** El seguimiento público mostraba comentarios internos. El calendario público devolvía `EventResponseDto` completo, con el contacto que el evento copia de la solicitud al convertirla.

**Decisión.** Cada endpoint anónimo tiene un DTO propio con una lista cerrada de campos (`TrackingResponse`, `PublicEventDto`). Ninguno reutiliza un DTO interno.

**Consecuencias.** Un campo nuevo en el evento no se publica solo, y para exponerlo hay que agregarlo al DTO público a propósito. La prioridad se publica porque el calendario la usa para el color.

**Se verifica en:** `PublicTrackingIntegrationTest`, `PublicEventsIntegrationTest`.

<a id="adr-26"></a>

### ADR-26 · Las lecturas cubren GET y HEAD; los prefijos admin cierran sin método

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-05 (`dc703db`); reemplaza a ADR-05

**Contexto.** ADR-05 cerraba cada prefijo admin con una regla sin método, pero las reglas de lectura seguían siendo solo `GET`. Spring MVC atiende `HEAD` con el handler `GET`, así que, como USUARIO, `HEAD` ejecutaba los controllers de `/api/audit/**`, `/api/tech/**` y `/admin/event-requests/**`.

**Decisión.** Toda regla de lectura de `SecurityConfig` usa `read(...)`, que aplica los mismos roles a `GET` y a `HEAD`. Se mantiene el cierre sin método de ADR-05 para los prefijos admin.

**Consecuencias.** `HEAD` responde lo mismo que `GET` en cada ruta, también para USUARIO en `/api/events/**`. El caso deja de depender de tests sueltos: la matriz lo verifica para cada endpoint.

**Se verifica en:** `PermissionMatrixIntegrationTest` (evalúa `HEAD` por cada `GET` no público).

<a id="adr-27"></a>

### ADR-27 · 401 sin autenticación, 403 sin permiso, y /error público

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-01 (`d8d239e`)

**Contexto.** En el contenedor real, cualquier error de una petición anónima llegaba como 403 vacío: login fallido, código de seguimiento inexistente, formulario público mal formado. El contenedor reenvía a `/error` tras un `sendError` y Spring Security bloqueaba ese reenvío. El cliente tampoco podía renovar el token, porque espera 401. MockMvc no hace ese reenvío, así que ningún test lo detectaba.

**Decisión.** `/error` es público. La falta de autenticación (o un token inválido o vencido) responde 401 con `HttpStatusEntryPoint`, y 403 queda para un rol sin permiso.

**Consecuencias.** El login muestra "credenciales incorrectas" y el seguimiento "código no encontrado". El interceptor del frontend renueva el token ante un 401.

**Se verifica en:** `ErrorStatusOverHttpIntegrationTest` (servidor HTTP real), `JwtAuthenticationIntegrationTest`.

<a id="adr-28"></a>

### ADR-28 · La clave de firma JWT es obligatoria y propia de cada entorno

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-11 (`799d64d`)

**Contexto.** `application.yml`, `docker-compose.yml` y `.env.example` traían la misma clave de firma por defecto. Sin `JWT_SECRET`, el sistema firmaba con una clave publicada en el repositorio, y cualquiera podía emitir un token válido.

**Decisión.** No hay clave por defecto. `JwtTokenProvider` no arranca si falta, si tiene menos de 32 bytes o si es la clave publicada. Compose falla con un mensaje que indica cómo generarla (`openssl rand -hex 32`).

**Consecuencias.** Cada entorno define su clave en `.env`. Rotarla cierra todas las sesiones abiertas. El perfil `test` y el runner E2E fijan claves propias.

**Se verifica en:** `JwtSecretValidationTest`.

<a id="adr-29"></a>

### ADR-29 · Los permisos salen del rol vigente; el restablecimiento corta sesiones

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-12 (`0126d3b`), REV-20 (`de9ba08`)

**Contexto.** El filtro JWT tomaba el rol del claim del token. Un ADMIN_FULL degradado conservaba sus permisos hasta el vencimiento y podía devolverse el rol. Restablecer una contraseña no invalidaba las sesiones anteriores. La revocación defensiva por reutilizar un refresh token se perdía por rollback.

**Decisión.** Los permisos se calculan en cada petición desde la cuenta. Restablecer revoca los refresh tokens, deja la cuenta en `mustChangePassword` y fija `sessions_invalid_before` (V17, REV-20): todo token emitido antes responde 401, también después de que el titular defina su contraseña. La desactivación fija la misma marca. Las revocaciones de `validate()` y `refresh()` no hacen rollback. El refresh rechaza cuentas desactivadas.

**Consecuencias.** Un cambio de rol rige desde la petición siguiente. El claim `role` del token queda como dato informativo para el cliente.

**Se verifica en:** `SessionRevocationIntegrationTest`.

<a id="adr-33"></a>

### ADR-33 · Las acciones sobre cuentas internas se auditan

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-09 (`1f37437`)

**Contexto.** CU-02 y RNF-05 del TFI piden trazabilidad de las acciones relevantes sobre cuentas, pero el alta, la edición, el cambio de rol, la activación y el restablecimiento no dejaban registro.

**Decisión.** La tabla `user_audit` (V16) guarda la cuenta afectada, el actor autenticado, el momento, la acción y un detalle sin contraseñas. `GET /api/users/{id}/history` la expone solo a ADMIN_FULL. Una edición o un cambio de rol sin cambios reales no se registra.

**Consecuencias.** El módulo `users` es dueño de la tabla. El frontend todavía no muestra este historial.

**Se verifica en:** `UserAdminAuditIntegrationTest`.

## Ciclo de vida de solicitudes y eventos

<a id="adr-09"></a>

### ADR-09 · Solicitud y evento tienen ciclos de vida distintos

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgo 2.1 (`eaf4a8d`), REQ-02 (`96dd380`, 2026-10-19)

**Contexto.** El seguimiento mostraba "Aprobada" para una solicitud `CONVERTIDO`, aunque el evento estuviera en revisión o rechazado.

**Decisión.** La solicitud recorre `RECIBIDO → EN_REVISION → CONVERTIDO | RECHAZADO`. Convertirla significa aceptarla para tramitar, y el evento creado nace en `EN_REVISION`. Cuando el evento existe, el seguimiento y los correos muestran su estado.

**Consecuencias.** En la interfaz interna, `CONVERTIDO` tiene color propio (celeste) y el verde queda para el evento `APROBADO`.

<a id="adr-10"></a>

### ADR-10 · Aprobar exige conformidad ceremonial y técnica

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgo 3.1 (`7933c8a`)

**Contexto.** No estaba claro si un evento sin soporte técnico necesitaba la conformidad de Técnica.

**Decisión.** Un evento pasa a `APROBADO` solo con `ceremonialOk` y `technicalOk`, aunque tenga `requiresTech=false`. La conformidad técnica es una validación institucional del área. `requiresTech` indica si el evento consume capacidad técnica.

**Consecuencias.** Técnica interviene en todos los eventos. Implementado en `EventStatusService.handleApproval`.

<a id="adr-11"></a>

### ADR-11 · Las conformidades se guardan por separado; la agenda se valida al bloquear

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgo 3.9 (`7933c8a`)

**Contexto.** Una conformidad parcial se registraba antes de validar disponibilidad y capacidad.

**Decisión.** Cada área registra su conformidad por su cuenta, y un OK parcial responde `202` con las faltantes. Disponibilidad y capacidad se validan al completar la aprobación o al reservar, que es cuando el recurso queda bloqueado.

**Consecuencias.** Una conformidad expresa la evaluación del área y no garantiza que la agenda siga libre. AC solo puede cambiar `ceremonialOk`, AT solo `technicalOk` y AF ambas.

<a id="adr-12"></a>

### ADR-12 · El área define el soporte técnico al convertir

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgo 3.2 (`226ca6a`), REQ-01 (`33a5b9d`, 2026-10-19)

**Contexto.** La conversión de una solicitud perdía `requiresTech`, y el solicitante no tiene criterio para declararlo.

**Decisión.** La solicitud pública no declara soporte técnico. El área lo define al convertir (body opcional `{requiresTech, techSupportMode}`), y el valor se guarda en el evento. Sin body el evento no consume capacidad. Con `requiresTech=true` y sin modo, el modo es `SETUP_ONLY`, y la conversión se rechaza si no hay cupo.

**Consecuencias.** El rechazo por falta de cupo al convertir todavía no tiene test.

**Se verifica en:** `RequestConversionIntegrationTest`.

<a id="adr-13"></a>

### ADR-13 · Capacidad técnica: configuración por migración y consumo serializado

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgos 3.5 y 5.3 (`dd0415b`), 3.6 (`7933c8a`), 5.2 (`4551e5a`)

**Contexto.** No había pantalla para administrar la capacidad, podían quedar varias configuraciones activas y dos reservas simultáneas podían consumir el mismo cupo.

**Decisión.**
- La configuración (`tech_capacity_config`) se cambia con una migración Flyway que desactiva la vigente e inserta la nueva. Si hubiera más de una activa, gana la de mayor `id`.
- La capacidad se calcula con `scheduleFrom`/`scheduleTo`, los buffers y `techSupportMode` (`ATTENDED`: horario completo; `SETUP_ONLY`: montaje y desmontaje). `technicalSchedule` es informativo.
- Las operaciones que consumen capacidad toman un bloqueo pesimista sobre la configuración activa. El pool usa `READ_COMMITTED`.

**Consecuencias.** Cambiar la capacidad requiere un despliegue. Con dos reservas simultáneas y un cupo libre, una responde 200 y la otra 409.

**Se verifica en:** `TechCapacityConcurrencyIntegrationTest` y la carrera real en MySQL de la verificación 5.7.

<a id="adr-14"></a>

### ADR-14 · Editar agenda o ubicación de un evento bloqueante lo devuelve a revisión

**Estado:** reemplazada por [ADR-25](#adr-25) · **Fecha:** 2026-10-01 · **Origen:** hallazgos 2.9 y 3.7 (`8af6b08`)

**Contexto.** Un evento aprobado podía cambiar de fecha, buffers o lugar y conservar las conformidades dadas para la agenda anterior.

**Decisión.** Se editan eventos en `EN_REVISION`, `RESERVADO` y `APROBADO`, y un evento `RECHAZADO` no se edita. Si un evento `RESERVADO` o `APROBADO` cambia agenda, ubicación o buffers, vuelve a `EN_REVISION`.

**Consecuencias.** Las áreas vuelven a dar conformidad sobre la agenda nueva. `EDITABLE_EVENT_STATUSES` del frontend repite la misma lista.

**Se verifica en:** `EventLocationAndReviewIntegrationTest`.

<a id="adr-15"></a>

### ADR-15 · La ubicación libre no es un recurso exclusivo

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgo 6.1 (`7933c8a`)

**Contexto.** Dos eventos podían indicar el mismo lugar libre a la misma hora sin conflicto.

**Decisión.** `freeLocation` representa lugares que la institución no gestiona (patios, espacios externos) y no se valida como recurso. Un lugar que deba bloquearse se da de alta como espacio del catálogo.

**Consecuencias.** `AvailabilityService.checkSpaceAvailability` responde `skipped=true` para ubicaciones libres.

<a id="adr-16"></a>

### ADR-16 · Conflictos de prioridad: tres roles consultan, dos resuelven, por API

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgos 1.6 (`9f0d668`), 3.4 (`f00f3e5`), 1.7-bis

**Contexto.** `/api/priority/conflicts/pending` no exigía rol, existía una decisión `CANCELLED` sin efecto y el cliente del frontend apuntaba a rutas y decisiones que no existen.

**Decisión.** AF, AC y AT consultan conflictos, y solo AF y AC los resuelven. Las decisiones son `REBOOK_OTHER` y `KEEP_ORIGINAL`. La pantalla de resolución queda como trabajo futuro, y hoy se opera por API.

**Consecuencias.** La pantalla de resolución queda como trabajo futuro y usará este mismo contrato. AT ve la alerta del dashboard con "Ver eventos" en lugar de "Resolver".

<a id="adr-17"></a>

### ADR-17 · Baja lógica auditada, por `PATCH`, en cualquier estado

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgos 2.2 (`3097d76`), 3.3-bis (`d0db212`), 4.5 (`941727b`)

**Contexto.** El frontend borraba con `DELETE /api/events/{id}`, que no existe. La interfaz solo permitía la baja en `SOLICITADO`, un estado que nunca se da. La baja no quedaba auditada.

**Decisión.** La baja es lógica (`active=false`) por `PATCH /api/events/{id}/soft-delete`. La pueden hacer los roles admin en cualquier estado, y queda auditada como `EVENT_DELETED`.

**Consecuencias.** El evento dado de baja conserva su historia y deja de aparecer en listados y calendario. API-01 completa el ticket con un test de borde: `DELETE` no da de baja.

**Se verifica en:** `EventSoftDeleteIntegrationTest`.

<a id="adr-18"></a>

### ADR-18 · Motivo de rechazo: público en la solicitud, interno en el evento

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgos 2.5 (`141f680`), 2.6 (`5b3734d`), 6.3 (`16c466e`)

**Contexto.** El motivo de rechazo era opcional en la API y no estaba definido quién lo ve.

**Decisión.** Rechazar una solicitud o un evento exige motivo, y el backend lo valida. El de la solicitud se le comunica al solicitante por correo y seguimiento. El del evento queda en la auditoría interna.

**Consecuencias.** El seguimiento nunca muestra el motivo ni las notas del rechazo de un evento, aunque provenga de una solicitud convertida (SEC-01).

<a id="adr-19"></a>

### ADR-19 · Los rechazos por conflicto no se auditan

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgo 4.3 (`5f25614`)

**Contexto.** Existían tipos de auditoría para rechazos por conflicto de espacio o capacidad que nunca se registraban.

**Decisión.** Esos rechazos abortan la operación con `409` sin persistir cambios, así que no generan auditoría. El usuario recibe el detalle del conflicto en la respuesta.

**Consecuencias.** La auditoría registra solo cambios que ocurrieron. Los tipos sin uso se eliminaron.

<a id="adr-20"></a>

### ADR-20 · Correos después del commit; una falla no revierte la operación

**Estado:** vigente · **Fecha:** 2026-10-01 · **Origen:** hallazgos 2.5 (`141f680`), 5.5 (`a5d6328`)

**Contexto.** Faltaban correos prometidos al solicitante, y en modo mock las fallas pasaban sin aviso.

**Decisión.** Los correos se envían con `@TransactionalEventListener(AFTER_COMMIT)` y `@Async`. Si la entrega falla, la operación se mantiene y se registra un `WARN` con destinatario y agregado. El perfil local usa `app.mail.mock-mode=true`, que solo escribe en el log y avisa al arrancar. El perfil `docker` entrega en Mailpit.

**Consecuencias.** Una operación confirmada puede quedar sin correo, y eso se ve en el log. Un test `@Transactional` no dispara los listeners. El solicitante recibe correo al crear la solicitud, al pasar a revisión, al ser rechazada y al ser convertida, y después con cada cambio de estado del evento. API-04 tiene pendiente decidir si se avisa la vuelta de `EN_REVISION` a `RECIBIDO`.

**Se verifica en:** `RequestEmailNotificationsIntegrationTest`.

<a id="adr-25"></a>

### ADR-25 · Toda modificación relevante de un evento reinicia su revisión

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-03 (`e392292`), REV-14 (`98d12ef`), REV-19 (`386abcd`); reemplaza a ADR-14

**Contexto.** ADR-14 devolvía a `EN_REVISION` un evento comprometido al editar su agenda, pero conservaba `ceremonialOk` y `technicalOk`: una sola área podía reaprobarlo. La reubicación por conflicto de prioridad (`REBOOK_OTHER`) ni siquiera lo devolvía a revisión.

**Decisión.** Si un evento `RESERVADO` o `APROBADO` cambia fecha, horario, ubicación o buffers, por edición o por reubicación, vuelve a `EN_REVISION`. En cualquier estado, ese cambio pone en `false` las conformidades que hubiera, también la parcial de un evento que todavía estaba en revisión. Cada reinicio se audita. Se publica el cambio de estado (correo y notificación) y, si cambió la agenda, la reprogramación. Un evento `RECHAZADO` o dado de baja no se edita.

**Consecuencias.** Coincide con RN-05 del TFI: las dos áreas evalúan la agenda nueva. La reversión manual por `POST /status` todavía conserva las conformidades que no se bajan explícitamente; queda como decisión pendiente.

**Se verifica en:** `EventLocationAndReviewIntegrationTest`, `RebookingRevisionIntegrationTest`.

<a id="adr-30"></a>

### ADR-30 · Las transiciones se serializan por fila, en un orden único, y las ediciones viejas fallan

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-06 (`86431d6`), REV-07 (`5814aab`), REV-15 (`7fc83bd`), REV-18 (`f949992`)

**Contexto.** Solo la capacidad técnica estaba serializada (ADR-13). Dos conversiones simultáneas de una solicitud creaban dos eventos. Ceremonial y Técnica aprobando a la vez perdían una conformidad. Dos reservas de eventos distintos en el mismo espacio quedaban las dos confirmadas.

**Decisión.**
- La conversión y el cambio de estado de una solicitud, y el cambio de estado de un evento, leen la fila con `PESSIMISTIC_WRITE`.
- Antes de comprometer ocupación (reserva o aprobación) se bloquea la fila del espacio. Con `READ_COMMITTED`, el control posterior ve lo ya confirmado.
- `Event` y `EventRequest` tienen `@Version` (V15). Una escritura sobre una copia vieja responde 409 `CONCURRENT_MODIFICATION`.
- Orden de bloqueo común: conflicto (al decidir), evento, espacio, configuración de capacidad. La edición y la reubicación bloquean el evento antes de consultar la capacidad.
- Un deadlock o una espera de bloqueo vencida responde 409 `CONCURRENT_MODIFICATION`; la operación se revirtió entera y se puede repetir.

**Consecuencias.** La segunda operación concurrente espera y se rechaza con 400 o 409. Una transición repetida choca con la tabla de transiciones en lugar de duplicar auditoría y avisos.

**Se verifica en:** `RequestConversionConcurrencyIntegrationTest`, `EventConcurrencyIntegrationTest`, `SpaceReservationConcurrencyIntegrationTest`.

<a id="adr-31"></a>

### ADR-31 · La solicitud pública no define la prioridad

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-04 (`0d04117`)

**Contexto.** `POST /public/event-requests` aceptaba `priority` del solicitante. La conversión la copiaba al evento y, con Alta, la reserva aplicaba la excepción de prioridad y desplazaba eventos ajenos. RN-09 del TFI lo prohíbe.

**Decisión.** El campo sale del DTO público y la solicitud queda en `MEDIUM`. El área ajusta la prioridad del evento ya convertido.

**Consecuencias.** El frontend todavía envía el campo; Jackson lo ignora.

**Se verifica en:** `PublicRequestPriorityIntegrationTest`.

<a id="adr-32"></a>

### ADR-32 · Las notificaciones internas son solo para cuentas administrativas

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-16 (`502a181`)

**Contexto.** Las notificaciones citan el nombre del evento, el autor y un extracto del comentario. Se enviaban al creador del evento sin mirar su rol, y una cuenta degradada a USUARIO seguía leyendo comentarios internos a los que ya no tenía acceso.

**Decisión.** `NotificationService` crea y entrega notificaciones solo a cuentas administrativas activas. Para cualquier otra, la bandeja está vacía y el contador en cero. Las guardadas se conservan.

**Consecuencias.** Si la cuenta recupera un rol administrativo, vuelve a ver sus notificaciones.

**Se verifica en:** `InternalNotificationAudienceIntegrationTest`.

<a id="adr-34"></a>

### ADR-34 · Un catálogo dado de baja no se asigna, pero no bloquea lo existente

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-08 (`eec78fd`), REV-13 (`467a946`)

**Contexto.** Los departamentos inactivos se aceptaban en altas y ediciones, contra RF-14. Al revés, un espacio dado de baja dejaba sin poder editar ni reservar a los eventos que ya lo tenían.

**Decisión.** Un espacio o departamento inactivo responde 404 en una asignación nueva (alta, cambio, solicitud pública). Un evento que ya lo tenía sigue operando, y reenviar su departamento actual en una edición se admite.

**Consecuencias.** RF-13 y RF-14 se cumplen sin dejar eventos bloqueados.

**Se verifica en:** `InactiveDepartmentIntegrationTest`, `EventLocationAndReviewIntegrationTest`.

## Proceso

<a id="adr-21"></a>

### ADR-21 · Migraciones Flyway inmutables

**Estado:** vigente · **Fecha:** 2026-10-03 · **Origen:** D2 (`df22516`)

**Contexto.** Las migraciones aplicadas forman parte del estado de cada base. Editar una deja bases que ya la corrieron con un esquema distinto al del código.

**Decisión.** Nunca se edita una migración existente. Un error se corrige con la siguiente migración, y la entidad JPA se actualiza en el mismo cambio, porque el perfil de test genera el esquema desde JPA y no corre Flyway.

**Consecuencias.** La historia de `db/migration` es acumulativa. Un desajuste entre migración y entidad no lo detectan los tests, solo el arranque contra MySQL.

<a id="adr-35"></a>

### ADR-35 · El motor de usuarios sintéticos se versiona y verifica la app por HTTP

**Estado:** vigente · **Fecha:** 2026-10-26 · **Origen:** REV-24

**Contexto.** `synthetic-user-engine/` estaba ignorado y usaba un contrato viejo: estados y roles retirados (`SOLICITADO`, `ADMIN_NORMAL`), rutas inexistentes y errores silenciados. Solo cargaba datos y no comprobaba nada.

**Decisión.** El motor se versiona en la raíz y se mantiene junto con la API: un cambio de rutas, DTOs, códigos o roles actualiza sus recorridos en el mismo ítem. Cinco personas con sesión propia recorren los circuitos completos por HTTP, y cada paso verifica una regla con el código y el cuerpo esperados. La matriz de permisos se lee de `permisos.json`. El motor no toca la base y no cambia la contraseña, el rol ni el estado de las cuentas semilla. Se corre contra el stack E2E descartable.

**Consecuencias.** Las carreras entre áreas y los circuitos que cruzan varios roles quedan probados sobre MySQL real y la imagen de producción, algo que los tests de integración (H2, un hilo por pedido) no cubren. Su primera corrida encontró REV-23. No reemplaza a los tests de integración ni al runner E2E: no corre en CI y depende de un stack levantado.

## Contratos de la API

<a id="adr-22"></a>

### ADR-22 · Filtros del listado de eventos en el cliente

**Estado:** reemplazada por [ADR-23](#adr-23) · **Fecha:** 2026-10-01 · **Origen:** hallazgo 2.3 (`8fff37c`)

**Contexto.** El cliente HTTP mandaba filtros que `GET /api/events` ignoraba, y `getEventStats`/`exportEvents` llamaban endpoints inexistentes.

**Decisión.** El backend acepta solo `page`, `size` y `sort`. Los filtros se aplican en el cliente sobre la página recibida, y se quitaron los parámetros y funciones que prometían otra cosa.

**Consecuencias.** El contrato quedó honesto, pero con paginación los filtros solo ven la página actual y los resultados quedan incompletos. Ese efecto motivó API-02.

<a id="adr-23"></a>

### ADR-23 · Filtros del listado de eventos en el servidor

**Estado:** propuesta · **Fecha:** 2026-10-24 · **Origen:** API-02

**Contexto.** Ver las consecuencias de [ADR-22](#adr-22).

**Decisión.** `GET /api/events` filtra en el servidor con una `Specification`: `q`, `status[]`, `priority[]`, `dateFrom`/`dateTo`, `spaceId[]`, `departmentId[]`, `internal` y `requiresTech`. Siempre excluye los eventos dados de baja. Se implementa en dos commits, backend y frontend.

**Consecuencias.** Los totales de página reflejan el filtro. El frontend deja de filtrar en memoria.

<a id="adr-24"></a>

### ADR-24 · Bandeja de solicitudes paginada en el servidor

**Estado:** propuesta · **Fecha:** 2026-10-24 · **Origen:** API-03

**Contexto.** `GET /admin/event-requests` devuelve una lista completa, y el frontend la pagina y filtra en memoria.

**Decisión.** El endpoint devuelve `Page` y acepta `page`, `size`, `sort`, `status[]`, `q`, `dateFrom` y `dateTo`. `publicRequests.api.ts` y su store se adaptan al contrato nuevo.

**Consecuencias.** La bandeja escala con el volumen de solicitudes. Cambia el contrato de respuesta, de lista a página, para todos sus consumidores.

## Sin registrar todavía

Las decisiones de stack del inicio del proyecto (Spring Boot con MySQL, React con Vite, JWT con refresh token persistido, Docker Compose) no tienen el motivo escrito en el repositorio. Quedan fuera de este registro hasta documentar por qué se eligieron.

## Agregar una decisión

Copiar esta plantilla al final de la sección que corresponda, sumar la fila al índice y, si reemplaza a otra, cambiar el estado de la anterior.

```markdown
<a id="adr-nn"></a>

### ADR-NN · <La decisión, en una frase>

**Estado:** propuesta | vigente | reemplazada por ADR-MM · **Fecha:** AAAA-MM-DD · **Origen:** <hallazgo o ticket> (`<commit>`)

**Contexto.** <Qué problema o desajuste se observó, con el dato concreto.>

**Decisión.** <Qué se hace. Nombres de clases, endpoints y estados.>

**Consecuencias.** <Qué cambia, qué cuesta y qué queda pendiente.>

**Se verifica en:** <test o guardián, si existe.>
```
