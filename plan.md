# Plan ejecutable — Docs sin ambigüedades, monolito modular vigilado y E2E

> **Archivo:** `plan.md`, en la raíz del repo. `AGENTS.md` lo enlaza como "plan activo".
> **Ejecuta:** Codex (u otro agente). **Revisa:** Claude, al terminar.
> **Estado:** en curso. Commit base: `2de6235`.

---

## 0. Cómo usar este plan (leer primero)

### Prerrequisitos del entorno del ejecutor
- **Red habilitada.** La necesitan Maven (ArchUnit), npm (Playwright) y la descarga de los navegadores de Playwright. En Codex: sandbox con acceso de red o modo de acceso completo.
- **Docker disponible** (`docker info` responde). Lo necesitan las fases E y F.
- **JDK:** la máquina tiene OpenJDK 24 y el proyecto compila a Java 17. Usar siempre `JAVA_HOME=$(/usr/libexec/java_home)`.
- **Node 22** con `frontend/node_modules` instalado (si falta, `npm ci` en `frontend/`).

### Protocolo
1. Ejecutar los ítems **en orden** (A1 → F5). Un ítem = **un commit** en la rama `migue/general`. Sin ramas nuevas, sin `push`, sin reescribir commits existentes.
2. Mensaje de commit: `<tipo>(<ID>): <qué>`, con `tipo` ∈ `fix`, `refactor`, `chore`, `test`, `docs`. Ejemplo: `fix(A2): formulario público usa disponibilidad pública`.
3. Antes de cada commit, correr la **verificación del ítem** y la **verificación base**:
   - Backend tocado: `cd backend && JAVA_HOME=$(/usr/libexec/java_home) ./mvnw -q test`, en verde.
   - Frontend tocado: `cd frontend && npx tsc -b && npm run build` OK. Además, el lint de cada archivo tocado no puede tener más errores que en `HEAD`:
     `npx eslint <f> | grep -c " error "` vs `git show HEAD:frontend/<f> | npx eslint --stdin --stdin-filename <f> | grep -c " error "`.
4. Después del commit: marcar el checkbox `[x]` y agregar una línea en la **Bitácora** (§6) con el ID, el hash, la verificación corrida y las notas.
5. **El código legacy SÍ se puede tocar y borrar** si está mal o muerto. Condición: antes de borrar, un `grep` confirma que no tiene consumidores, y eso se anota en la Bitácora.
6. **Detenerse** (anotar `BLOQUEADO: …` en la Bitácora y no improvisar) si:
   - una verificación falla 2 veces seguidas;
   - algo marcado como "muerto" tiene consumidores;
   - aparece una regla de negocio que no está en `docs/decisiones-funcionales.md` ni en §1.3;
   - hay que editar una migración Flyway ya existente (V1–V14): **nunca** se editan; se agrega una nueva.

---

## 1. Contexto

### 1.1 Qué es
Gestión de Eventos (TFI UNLa). Hay dos tipos de usuarios:
- **Público, sin login:** pide un evento (`EventRequest`) y lo sigue con un UUID.
- **Áreas internas:** revisan la solicitud, la convierten en `Event` y la aprueban (conformidad ceremonial + técnica).

**Roles:** `ADMIN_FULL` (AF), `ADMIN_CEREMONIAL` (AC), `ADMIN_TECNICA` (AT), `USUARIO` (U).

### 1.2 Estado de partida
- El commit base es **`2de6235`**. Los 45 hallazgos de un reporte externo están corregidos, con 39 tests de integración.
- Historia archivada en `docs/historial/hallazgos-2026-10.md`, decisiones en `docs/decisiones-funcionales.md`, permisos en `docs/permisos.md`.
- Una auditoría posterior encontró los problemas que corrige este plan:
  - docs contradictorios;
  - un contrato del frontend con tipos y endpoints inventados;
  - bugs y un riesgo de seguridad;
  - fronteras entre módulos sin vigilancia;
  - falta de un E2E repetible.

### 1.3 Decisiones cerradas (no reabrir)
- **Un solo archivo de instrucciones.** `AGENTS.md` es el canónico para todos los agentes; `CLAUDE.md` solo lo importa.
- **Arquitectura:** monolito modular "tipo microservicios". Se documenta y se vigila con un test (ArchUnit) y con lint. La deuda actual se **congela**; no se refactoriza en este plan.
- **Permisos y reglas de negocio:**
  - USUARIO **lee** catálogos.
  - La baja (soft-delete) de eventos se permite en cualquier estado, a los roles admin.
  - AT ve los conflictos de prioridad pero **no** los resuelve; resuelven AF y AC.
  - El motivo de rechazo de una **solicitud** lo ve el solicitante; el de un **evento** es interno.
  - **Edición de eventos:** se permite en EN_REVISION, RESERVADO y APROBADO. **RECHAZADO no se edita.** Un APROBADO o RESERVADO vuelve a EN_REVISION si cambia la agenda, la ubicación o los buffers (ya implementado).
  - La conformidad técnica es siempre obligatoria para APROBADO.
- **Alcance:**
  - La pantalla de resolución de conflictos queda como **alcance futuro** (va a `docs/backlog.md`).
  - Se elimina `.atl/` (gentle-ai ya no se usa). `artifacts/` y `synthetic-user-engine/` quedan **locales e ignorados**.
- **Entorno:**
  - Dev sin Docker: **proxy en Vite** hacia `localhost:9090`.
  - Correos: override opcional de compose que publica la UI de **Mailpit** (el servicio se llama `mailhog` por historia).

### 1.4 Arquitectura actual (hechos de la auditoría)
**Backend** (`backend/src/main/java/com/mvp/backend/`): los módulos son `feature/{auth,availability,catalogs,comments,events,history,notifications,priority,requests,tech,users}`, más `shared/`, `config/` y `BackendApplication`.
- **24 inyecciones de repositorios de otro módulo** en 10 archivos:
  - `CustomUserDetailsService`, `AvailabilityService`, `EventCommentService`, `EventService`;
  - `EmailNotificationListener`, `NotificationEventListener`, `NotificationService`;
  - `PriorityConflictService`, `EventRequestService`, `TechCapacityService`.
- **Escrituras en tablas ajenas:**
  - `EventRequestService` guarda `Event` (≈l.499), `EventHistory` (≈l.501) y `EventRequestHistory`;
  - `PriorityConflictService` guarda `Event` (≈l.80, 85, 156, 218).
- **12 ciclos entre módulos.** `events` es el hub; ejemplos: events↔requests, events↔priority, events↔tech, events↔history, events↔notifications, auth↔users.
- **Eventos de dominio** declarados en el consumidor (`notifications/event`), no en quien los publica. `PriorityConflictCreatedEvent` (`priority/event`) se publica y nadie lo escucha.
- **`shared/GlobalExceptionHandler`** importa excepciones y un mapper de `auth`, `availability` y `tech`.
- Los controllers solo inyectan servicios de su propio módulo. Hay 2 imports cruzados: `AdminEventRequestController` → `EventResponseDto` y `NotificationController` → `UserPrincipal`.

**Frontend** (`frontend/src/`): las features son `admin/users`, `auth`, `catalogs`, `dashboard`, `events`, `public`, `publicRequests` y `users`.
- **Imports cruzados entre features:**
  - `public/LoginPage` y `users/ProfilePage` → `auth/*` (aceptado: `auth` es la sesión de toda la app);
  - `publicRequests/PublicRequestDetailPage` → `events/utils/status-helpers` (a corregir).
- **Capas invertidas:** `services/api/publicRequests.api.ts:25` y `store/publicRequests.store.ts` importan `features/publicRequests/utils/list-sorting`.
- **Clientes HTTP:**
  - `services/api/client` (vigente, usado por los `*.api.ts`);
  - `lib/http.ts` (sesión y refresh, usado por `features/auth`, y legacy por `services/api/{events,priority,tech,users}.ts`);
  - `services/http/client.ts` (muerto);
  - `fetch` crudo en `services/api/public-events.ts`.

---

## 2. Contexto técnico para un agente nuevo
- **Backend:**
  - Spring Boot 3.5.5, JPA, MySQL 8, Flyway (V1–V14), JWT (jjwt), Lombok.
  - Mappers escritos a mano. Errores en `shared/GlobalExceptionHandler` (`DomainValidationException` → 400).
  - Auditoría vía `history/service/AuditService`. Usuario actual vía `auth/security/CurrentUserService`. Correos con `@TransactionalEventListener(AFTER_COMMIT)` + `@Async`.
- **Tests:**
  - Extender `src/test/java/com/mvp/backend/support/IntegrationTestBase`: usuarios por rol con JWT real, y helpers `newSpace`, `newDepartment`, `newEvent(status)` y `createPublicRequest()`.
  - El perfil `test` es **H2 sin Flyway**: el schema lo generan las entidades, así que una columna nueva va también en la entidad.
  - Un test con `@Transactional` **no** dispara los listeners `AFTER_COMMIT`. Para verificar correos se usa `@MockitoBean EmailService` + `verify(..., timeout(3000))`, como en `RequestEmailNotificationsIntegrationTest`.
- **Frontend:**
  - React 19, Vite 7, TypeScript, Zustand, react-hook-form + zod, shadcn/Tailwind 4, CASL (`libs/ability.ts`).
  - No hay runner de tests unitarios. El lint actual tiene unos 63 errores **previos**: la regla es no sumar ninguno nuevo.
- **Docker:**
  - `docker compose up --build`, en `http://127.0.0.1:8080`. nginx hace proxy de `/api`, `/auth`, `/public` y `/admin` a `backend:9090`.
  - Stack aislado para pruebas: `FRONTEND_PORT=18080 docker compose -p gestion-eventos-mvp-check …` y después `down -v`.
- **Seeds:**
  - Usuarios `admin.full`, `admin.ceremonial`, `admin.tecnica` y `viewer` (USUARIO).
  - Contraseña según el comentario de `V2__seed.sql:31`: `admin123`. **Sin verificar:** E1 la verifica por login. Si no funciona, el script E2E asigna una contraseña conocida **solo en la base descartable del stack aislado**.

---

## 3. Fases

### Fase A — Bugs y seguridad
- [x] **A1 · Consola H2 fuera de producción.**
  - **Evidencia:** `backend/pom.xml` (h2 `scope runtime`); `application.yml` (`spring.h2.console.enabled: true` para todos los perfiles) y `spring.security.user` `admin/admin123`, que no se usa.
  - **Cambio:** h2 pasa a `<scope>test</scope>`. Se borran `spring.h2.console.*` y `spring.security.user` de `application.yml`. Si un test necesita consola, va en `application-test.yml`.
  - **Hecho cuando:** `./mvnw test` está en verde y `jar tf target/*.jar | grep -c h2` da 0 después de `./mvnw -q -DskipTests package`.
- [x] **A2 · El formulario público usa la disponibilidad pública.**
  - **Evidencia:** `frontend/src/features/public/components/PublicEventForm.tsx:176` llama a `availabilityApi.checkAvailability` (`/api/availability/check`, que requiere login). Existe `checkPublicAvailability` (`services/api/availability.api.ts:228`).
  - **Cambio:** usar `checkPublicAvailability` y adaptar el render si la respuesta pública trae menos campos (los conflictos no traen título).
  - **Hecho cuando:** sin sesión, el chequeo responde 200. Se verifica en E1.
- [x] **A3 · `AudienceType` del frontend igual al enum Java.**
  - **Evidencia:** Java `shared/AudienceType` = `ESTUDIANTES, DOCENTES, AUTORIDADES, COMUNIDAD, TERCERA_EDAD`. El frontend tiene `MIXTO` y le falta `TERCERA_EDAD` (`services/api/types/backend.types.ts:47-53`, `features/public/components/PublicAudienceTypeSelect.tsx:17`, labels y schemas zod).
  - **Cambio:** alinear en todos los usos (`grep -rn "MIXTO\|AudienceType" frontend/src`).
  - **Hecho cuando:** no hay ningún `MIXTO` y el formulario ofrece "Tercera edad".
- [x] **A4 · La bandeja no oculta solicitudes rechazadas o convertidas.**
  - **Evidencia:** `frontend/src/store/publicRequests.store.ts` (≈l.233 y ≈l.277) filtra el ítem tras rechazar o convertir, con un comentario "Technical debt" que ya no aplica (existe `GET /admin/event-requests`).
  - **Cambio:** actualizar el ítem en su lugar (status, `convertedEventId`) y borrar los comentarios de deuda.
- [x] **A5 · Regla de edición: RECHAZADO no se edita.**
  - **Backend:** `feature/events/service/EventService.update` lanza `DomainValidationException("No se puede editar un evento rechazado")` si `status == RECHAZADO`. Test nuevo `EventEditRuleIntegrationTest`: RECHAZADO → 400; APROBADO → 200 y vuelve a EN_REVISION si cambia la fecha.
  - **Frontend:** `features/events/utils/edit-event.ts` (`getEditBlockReason`) y `status-helpers.ts` (`canEditEvent`, ≈l.103-104, 120, 150) permiten editar APROBADO y bloquean RECHAZADO. Se corrigen los comentarios que llaman "final" a APROBADO (el backend permite APROBADO→EN_REVISION).
- [x] **A6 · Entorno de desarrollo y Docker sin trampas.**
  - `frontend/vite.config.ts`: `server.proxy` para `/api`, `/auth`, `/public` y `/admin` → `http://localhost:9090`. Así `VITE_API_BASE_URL` vacío funciona igual en dev y en Docker.
  - `frontend/.env.example`: aclarar que vacío es lo correcto en dev (proxy) y en Docker (nginx).
  - `.env.example`:
    - `APP_CORS_ALLOWED_ORIGINS=http://127.0.0.1:8080,http://localhost:8080`, igual que el default de `docker-compose.yml`. Hoy dice `5173`.
    - Agregar `APP_PUBLIC_BASE_URL=http://127.0.0.1:8080`, con un comentario: "debe coincidir con `FRONTEND_HOST:FRONTEND_PORT`".
  - `docker-compose.yml`: pasar `APP_PUBLIC_BASE_URL: ${APP_PUBLIC_BASE_URL:-http://127.0.0.1:${FRONTEND_PORT:-8080}}` al backend.
  - Nuevo `docker-compose.mail-access.yml` que publica `mailhog` (imagen Mailpit) en `${MAILPIT_HOST_PORT:-8025}:8025` sobre `127.0.0.1`.
- [x] **A7 · Detalles que confunden.**
  - `feature/requests/controller/AdminEventRequestController.java`: los Javadoc están cruzados (≈l.24-26 describe "Detalle" sobre `list()`; ≈l.41-44 describe `changeStatus` sobre `history()`). Ponerlos en el método correcto.
  - `src/test/.../priority/PriorityConflictAccessIntegrationTest.java:16`: quitar `deciderUserId` del mapa `DECISION`. Se mantiene a propósito en `PriorityConflictDecisionIntegrationTest`.
  - `frontend/src/utils/catalog-filters.ts:6` dice "backend no soporta ?q=", pero los controllers de catálogos sí lo aceptan. Corregir el comentario, o usar `q` si es trivial.
  - `features/dashboard/hooks/useFilteredEvents.ts:82-83`: implementar `myEventsOnly` con `useAuth` (comparando `createdBy.id`) o borrar la opción si no hay UI que la use.
  - `services/api/client/config.ts:24`: el comentario de ejemplo usa `/api/auth/login` y el usuario `admin`. Corregir a `/auth/login` y `admin.full`.

### Fase B — Legacy: poda y unificación (se permite tocarlo)
Para cada grupo, antes de borrar o mover, correr `grep -rn "<símbolo o ruta>" frontend/src backend/src` y anotar en la Bitácora que no hay consumidores.
- [ ] **B1 · Clientes y servicios muertos:** `services/http/client.ts`, `services/api/{spaces,departments,calendar}.ts` y `libs/msw.ts`.
- [ ] **B2 · Stores, hooks y páginas muertas:**
  - stores `comments`, `audit`, `availability` y `auth.slice.ts`;
  - `features/events/pages/CalendarPage.OLD.tsx`, `hooks/useCalendarEvents.ts` y `services/calendar.service.ts`;
  - `features/auth/components/ProtectedRoutes.tsx`;
  - `hooks/{useUrlSync,useCalendarRange,useModal}.ts` y `useCanAccessEvent` en `hooks/useCan.ts`;
  - `hooks/api/{useComments,useEventStatus}.ts` y su barrel;
  - `store/presets.getDefaultPresetForRole`, si no tiene uso.
- [x] **B3 · Slices de `useAppStore`** (`ui`, `calendar`, `events`). Después de B2, si sus estados ya no tienen lectores, quitarlos de `store/index.ts` y subir la `version` del `persist`, con un `migrate` que descarte las claves viejas. Si quedan lectores, documentarlos como legacy y no tocarlos.
- [x] **B4 · Conflictos de prioridad ficticios en el frontend:**
  - `catalogsApi.getConflicts`, `makeDecision` y `resolveMultipleConflicts`;
  - las acciones `fetchConflicts`/`makeDecision` de `store/catalogs.store.ts`;
  - las constantes `INTERNAL_PRIORITY_*` de `client/config.ts`;
  - los tipos asociados.
  - Lo único vigente es `services/api/priority.ts` → `/api/priority/conflicts/pending`.
- [ ] **B5 · Funciones que llaman endpoints inexistentes:**
  - `eventsApi.checkAvailability` (`events.api.ts:344`, `/api/events/check-availability`): borrarla, o redirigirla a `availabilityApi` si tiene uso;
  - el export de `audit.api.ts:380` (`/api/audit/{id}/export`);
  - en `availability.api.ts`: `getTechCapacity`, `getTechEvents`, `hasTechCapacity`, `getTopUtilizedBlocks` y `findFirstAvailableSlot`, si quedan sin consumidores después de B2.
- [x] **B6 · `services/api/types/backend.types.ts` honesto.** El encabezado afirma "deben coincidir con los DTOs Java". Por cada tipo, **si no tiene uso, se borra; si lo tiene, se alinea con el DTO Java**. Casos conocidos:
  - `CommentVisibility.PUBLIC` (Java solo tiene `INTERNAL`);
  - estados de solicitud `RECEIVED/CONVERTED` (Java: `RECIBIDO/EN_REVISION/CONVERTIDO/RECHAZADO`);
  - estados de conflicto `PENDING/RESOLVED` (Java: `OPEN/CLOSED`);
  - `KEEP_NEW/KEEP_DISPLACED` y `conflictCode` (Java: `REBOOK_OTHER/KEEP_ORIGINAL`, `conflictId`, `target` como objeto);
  - las respuestas de disponibilidad de ≈l.419-431 y ≈l.664-674 (Java: `isAvailable, skipped, reason, effectiveFrom, effectiveTo, conflicts`);
  - la ocupación de ≈l.693-709 (Java: `{spaceId, date, blocks[{from,to,status}]}`);
  - el `EventRequestCreatedResponse` duplicado en camelCase (≈l.517) frente al correcto en snake_case (≈l.602);
  - los campos "Deprecated: compat" (≈l.259, 280);
  - los "Endpoint: /internal/…" (≈l.435, 453, 470, 480).
  - Corregir también los JSDoc con payloads falsos en `catalogs.api.ts`, `availability.api.ts` (≈l.390-403) y `comments.api.ts` (≈l.72, 91).
  - **Hecho cuando:** `grep -rn "/internal/\|KEEP_NEW\|KEEP_DISPLACED\|RESOLVED\|'PUBLIC'" frontend/src` no da resultados.
- [x] **B7 · Un solo cliente HTTP para la API.** Migrar `services/api/{events,priority,tech,users}.ts`, que hoy usan `lib/http.ts`, y `public-events.ts` (`fetch` crudo) al cliente `services/api/client`. Se mantienen las firmas para no tocar a los consumidores (`useTodayEvents`, `usePriorityConflicts`, `useTechCapacity`, `UsersPage`, `PublicCalendarPage`). `lib/http.ts` queda **solo** para sesión (tokens y refresh de `features/auth`). Comprobar que los dos clientes leen el mismo token (`accessToken` en `localStorage`); si no, unificar la clave.
  - **Hecho cuando:** `grep -rln "lib/http" frontend/src` solo muestra `features/auth/*`.
- [x] **B8 · Backend legacy:**
  - quitar el `import ...events.model.Event` sin uso de `feature/users/model/User.java` (rompe el ciclo users↔events);
  - borrar `feature/priority/event/PriorityConflictCreatedEvent.java` y su `publishEvent` en `PriorityConflictService` (nadie lo escucha);
  - migrar las 5 copias privadas de `getCurrentUser()` (`EventCommentService`, `EventRequestService`, `EventStatusService`, `EventService`, `UserAdminService`) a `auth/security/CurrentUserService`.
- [x] **B9 · Capas del frontend:**
  - mover `features/publicRequests/utils/list-sorting.ts` a `src/utils/request-sorting.ts`, porque lo usan `services/api` y `store`;
  - mover los helpers de estado y prioridad de `features/events/utils/status-helpers.ts` a `src/utils/event-status.ts`, porque los usan `events` y `publicRequests`;
  - actualizar los imports.

### Fase C — Guardianes de arquitectura
- [x] **C1 · `backend/src/test/java/com/mvp/backend/architecture/ModuleBoundariesTest.java`** con ArchUnit (`com.tngtech.archunit:archunit-junit5`, scope `test`, última versión 1.x en el `pom.xml`).
  - Importa `com.mvp.backend` con `ImportOption.DoNotIncludeTests`. Módulo de una clase: `feature.<x>` → `x`; si no, `shared`, `config` o `root`.
  - **Regla 1:** el conjunto de aristas `origen->destino` entre módulos distintos (dependencias directas, sin contar `java.*`) tiene que ser **igual** a `ALLOWED_MODULE_EDGES`. Un `Set<String>` literal en el test, generado la primera vez desde el estado **posterior a la Fase B**. El test falla ante una arista nueva ("dependencia no permitida: documentar en docs/arquitectura.md o evitarla") y ante una que ya no existe ("deuda pagada: quitarla de la lista"). Es un trinquete: la deuda solo baja.
  - **Regla 2:** los usos de clases de `feature.<y>.repository` desde el módulo `x ≠ y` tienen que ser **iguales** a `ALLOWED_FOREIGN_REPOSITORY_USES` (`"ClaseOrigen -> Repositorio"`), con el mismo trinquete.
  - **Regla 3:** las clases de `feature.<x>.controller` solo dependen de `feature.<x>`, `shared`, `java`, `jakarta`, `org.springframework`, `lombok` y `io.swagger`, salvo la allowlist (`AdminEventRequestController -> EventResponseDto`, `NotificationController -> UserPrincipal`).
  - **Regla 4:** las clases de `feature.notifications.event` tienen que ser **iguales** a la allowlist actual. Los eventos nuevos van en el paquete `event` del módulo que los publica.
  - Cada lista lleva el comentario `// Deuda congelada — ver docs/arquitectura.md#deuda`.
  - **Pruebas negativas** (temporales, no se commitean): inyectar `EventRepository` en un controller falla la regla 3; agregar `DepartmentRepository` temporalmente a `TechCapacityService` falla solo la regla 2 (la arista `tech→catalogs` ya existe); usar `UserRepository` desde `tech` falla las reglas 1 y 2; un probe temporal en `shared.Priority` falla la regla 1. Todos los probes se revirtieron y no se agregó allowlist.
- [x] **C2 · Zonas de ESLint** en `frontend/eslint.config.js` con `no-restricted-imports`, generado con un loop sobre `fs.readdirSync('src/features')`:
  - `src/services/**` y `src/store/**` → prohibido `@/features/*`;
  - `src/features/<x>/**` → prohibido `@/features/<y>/**` para todo `y ≠ x` salvo `auth`;
  - mensaje: "Ver docs/arquitectura.md#frontend".
  - **Prueba negativa:** un import de `@/features/events/...` desde `services/api/*.ts` debe dar un error de lint. Revertirlo.

### Fase D — Documentación (una regla, un lugar)
**Principios:**
- Imperativo y verificable: cada regla nombra el archivo o el test que la comprueba.
- Sin números que caducan: se cita el comando que los calcula.
- Se separan **regla vigente**, **deuda conocida** e **historia**.
- Español. Los otros docs enlazan; no repiten.

- [x] **D1 · `.gitignore` y ruido:**
  - borrar `.atl/`;
  - agregar `.atl/`, `artifacts/` y `synthetic-user-engine/` al `.gitignore`;
  - borrar las carpetas locales `.github/modernize/` y `backend/.github/java-upgrade/` (ya ignoradas; son plantillas de otra herramienta con instrucciones dirigidas a agentes).
- [x] **D2 · `docs/arquitectura.md` (nuevo).**
  - **(a)** Estilo: monolito modular "tipo microservicios", con una sola base compartida.
  - **(b)** Tabla de módulos: responsabilidad, API pública (servicios y DTOs) y tablas que posee.
  - **(c)** Reglas vigentes:
    1. el repositorio de un módulo es privado;
    2. los controllers solo usan su propio módulo;
    3. escribir en la tabla de otro módulo se hace solo vía su servicio dueño (por ejemplo, `AuditService`);
    4. los eventos de dominio se declaran en el `event` del módulo que los publica, transportan IDs y se escuchan con `AFTER_COMMIT`;
    5. `shared/` no depende de `feature/`;
    6. se aceptan relaciones JPA (`@ManyToOne`) hacia entidades de otro módulo, porque la base es una sola;
    7. no se agrega una dependencia entre módulos sin actualizar este doc y `ModuleBoundariesTest`.
  - **(d)** Mapa de dependencias actual (tabla adyacente y diagrama mermaid).
  - **(e) `#deuda`:** repositorios ajenos, escrituras ajenas, eventos en `notifications/event`, `GlobalExceptionHandler` y ciclos, ordenados por impacto.
  - **(f) `#frontend`:**
    - capas `app → features → (store | services/api | components | hooks | libs | models | utils)`;
    - una feature no importa otra salvo `auth`;
    - código nuevo usa `services/api/client` a través de un `*.api.ts`;
    - CASL es el único sistema de permisos;
    - legacy remanente: `useRole` solo se usa para mostrar etiquetas.
  - **(g)** Guardianes: `ModuleBoundariesTest` y las zonas de ESLint.
  - **(h)** "Cómo agregar…": un endpoint, un módulo, un evento de dominio, una migración.
- [x] **D3 · `AGENTS.md` canónico** (reescribir):
  - qué es el proyecto, stack, comandos (test, build, lint por archivo, E2E de la Fase E);
  - mapa de docs, "dónde está cada regla";
  - reglas de trabajo: commits por ítem; tests de integración con `IntegrationTestBase`; lint sin errores nuevos; **migraciones: el siguiente número es el que sigue a** `ls backend/src/main/resources/db/migration | sort -V | tail -1`, y **nunca** se edita una aplicada; el código legacy se puede tocar si se prueba que está mal o muerto;
  - qué ignorar: `artifacts/`, `synthetic-user-engine/` (local, contrato viejo) y `docs/historial/`;
  - "Plan activo: `plan.md`" (al terminar el plan, moverlo a `docs/historial/` y quitar esta línea).
  - `CLAUDE.md` queda solo con `@AGENTS.md`.
- [x] **D4 · `docs/permisos.md`:**
  - declarar que es la fuente de verdad del contrato;
  - agregar `POST /auth/login`, `/auth/refresh` y `/auth/logout`, `GET /actuator/health` y Swagger (`/swagger-ui/**`, `/v3/api-docs/**`, públicos según `SecurityConfig`);
  - checklist "cambiar un permiso = este doc + `SecurityConfig` + test de integración + `libs/ability.ts` (y rutas/sidebar si aplica)".
- [x] **D5 · `docs/decisiones-funcionales.md`:**
  - pasar a "decididas" las 4 decisiones de §1.3;
  - agregar la regla de edición;
  - sección "Alcance futuro": pantalla de conflictos (hoy solo por API);
  - los IDs del reporte quedan como referencia ("(hallazgo 3.1)") y no como título.
- [x] **D6 · Historia:**
  - archivar la historia en `docs/historial/hallazgos-2026-10.md`;
  - encabezado "Documento histórico, no normativo";
  - borrar la sección "Pendientes para decidir juntos" (queda resuelta acá);
  - corregir las afirmaciones falsas: "el simulador usa CANCELLED" y "la contraseña no está en el repo";
  - quitar "Próxima migración libre".
- [x] **D7 · `docs/backlog.md` (nuevo).** Cada tarea especificada para que un agente la tome, con endpoints, roles, payloads reales y un criterio de "hecho":
  - pantalla de resolución de conflictos (`GET /api/priority/conflicts/pending`, `POST /api/priority/decisions` `{conflictId, decision: REBOOK_OTHER|KEEP_ORIGINAL, target?:{date,from,to,spaceId}, reason?}`, solo AF y AC);
  - pago de la deuda de arquitectura, en orden: las escrituras ajenas primero, después los eventos de `notifications/event` hacia sus publicadores, después los repositorios ajenos;
  - actualizar `synthetic-user-engine` al contrato vigente, si se decide versionarlo.
- [x] **D8 · `DOCKER.md`:**
  - "MailHog" → Mailpit (servicio `mailhog`);
  - cómo ver correos con el override (`docker compose -f docker-compose.yml -f docker-compose.mail-access.yml up`, en `http://127.0.0.1:8025`);
  - tabla completa de variables: `FRONTEND_*`, `MYSQL_*`, `MAIL_*`, `APP_PUBLIC_BASE_URL`, `APP_CORS_ALLOWED_ORIGINS`, `JWT_*`, `BACKEND_JAVA_OPTS`, `VITE_API_BASE_URL`, `DB_WAIT_TIMEOUT_SECONDS`;
  - usuarios sembrados y contraseña (la verificada en E1);
  - stack aislado con otro puerto: setear `APP_PUBLIC_BASE_URL` y `APP_CORS_ALLOWED_ORIGINS` acordes;
  - E2E (Fase E).
- [x] **D9 · READMEs.** `frontend/README.md` reemplaza el boilerplate de Vite. Nuevo `backend/README.md`. Cada uno con 15–25 líneas: scripts, estructura, cómo correr y links a `AGENTS.md` y `docs/arquitectura.md`.

### Fase E — E2E automatizado y repetible
- [x] **E1 · E2E de API: `scripts/e2e/api_smoke.py`.** Python 3 con la biblioteca estándar solamente (urllib, threading, json). Corre contra `BASE_URL`, por defecto `http://127.0.0.1:18080`, a través de nginx. Cada caso imprime `PASS`/`FAIL`, y el exit code es ≠0 si alguno falla. Casos mínimos:
  1. `GET /` (frontend) → 200; `GET /h2-console` → 404 o 403, nunca la consola.
  2. **Público:**
     - `GET /public/catalogs/spaces` → 200;
     - `POST /public/availability/check` sin token → 200;
     - `POST /public/event-requests` con `audienceType=TERCERA_EDAD` → 201 con `tracking_uuid`;
     - `GET /public/track/{uuid}` → `request.status=RECIBIDO` y `schedule.from` con formato `HH:mm`;
     - `GET /public/event-requests` → 4xx.
  3. **Login** de los 4 usuarios sembrados con `E2E_PASSWORD` (por defecto `admin123`). Si falla, el runner (E3) ya asignó una contraseña conocida en la base descartable.
  4. **Bandeja y conversión:**
     - `GET /admin/event-requests` como AF → 200 con la solicitud; como USUARIO → 403;
     - pasar a `EN_REVISION`;
     - `convert-to-event` con `{requiresTech:true, techSupportMode:"ATTENDED"}` → evento EN_REVISION con `requiresTech` en true;
     - `GET /admin/event-requests/{id}/history` → actor presente en las transiciones.
  5. **Privacidad:** crear un comentario interno en el evento → el `GET /public/track/{uuid}` **no** contiene su texto ni `event.id`.
  6. **Permisos:**
     - USUARIO: `PATCH /api/events/{id}` → 403; `GET /api/events` → 200; `GET /api/catalogs/spaces` → 200;
     - AT: `POST /api/priority/decisions` → 403;
     - sin token: `GET /admin/event-requests` → 4xx.
  7. **Flujo de aprobación:**
     - AC aprueba → 202 (falta la conformidad técnica);
     - AT aprueba → 200 APROBADO;
     - el evento aparece en `GET /public/events`.
  8. **Regla de edición:**
     - editar APROBADO cambiando la fecha → 200 y EN_REVISION;
     - rechazar un evento sin motivo → 400; con motivo → 200;
     - editar RECHAZADO → 400.
  9. **Rechazo de solicitud:** sin motivo → 400; con motivo → 200, y el tracking muestra `rejectionReason`.
  10. **Baja:** soft-delete como AF → 204, y la auditoría tiene `EVENT_DELETED` con actor.
  11. **Concurrencia de capacidad técnica:**
      - el runner fija `default_slots_per_block=1` en la base descartable;
      - se crean 2 eventos técnicos en el mismo horario, en espacios distintos;
      - se reservan los dos en paralelo con hilos → exactamente un 200 y un 409.
  12. **Correo:** con el override de Mailpit, `GET http://127.0.0.1:${MAILPIT_HOST_PORT:-8025}/api/v1/messages` contiene la confirmación (con el UUID), la revisión, el rechazo con su motivo y la conversión.
- [x] **E2 · E2E de navegador con Playwright: `frontend/e2e/`.**
  - Agregar `@playwright/test` como devDependency, `frontend/playwright.config.ts` (`baseURL` desde `E2E_BASE_URL`, solo chromium) y el script `"e2e": "playwright test"`. Instalar con `npx playwright install chromium`.
  - Specs mínimos, con selectores por rol o texto visible:
    1. `public-request.spec.ts`: completar el formulario público sin login (chequeo de disponibilidad sin error, audiencia "Tercera edad"), enviar, ver la confirmación con el código y abrir `/track/<uuid>` → "Recibida".
    2. `admin-flow.spec.ts`: login `admin.full` → bandeja `/solicitudes` muestra la solicitud → revisar → convertir con "Requiere soporte técnico" → se abre el detalle del evento; agregar y editar un comentario interno.
    3. `usuario.spec.ts`: login `viewer` → el sidebar muestra "Solicitar evento" y no muestra "Solicitudes" ni "Catálogos"; `/events/<id>/edit` → página de no autorizado.
    4. `password.spec.ts` (opcional): el admin crea un usuario → login con la contraseña temporal pide cambiarla. La contraseña temporal se lee de Mailpit.
  - Excluir `e2e/` del `tsconfig` de la app si hace falta, para no romper `tsc -b`.
- [x] **E3 · Runner único: `scripts/e2e/run.sh`.**
  1. `docker compose -p gestion-eventos-mvp-e2e -f docker-compose.yml -f docker-compose.mail-access.yml up -d --build`, con `FRONTEND_PORT=18080`, `MAILPIT_HOST_PORT=18025`, `APP_PUBLIC_BASE_URL=http://127.0.0.1:18080` y `APP_CORS_ALLOWED_ORIGINS=http://127.0.0.1:18080`.
  2. Esperar a que el backend esté sano: loop sobre `docker compose ps` o `curl /` hasta 180 s.
  3. Verificar el login de `admin.full` con `admin123`. Si falla, asignar con `docker compose exec mysql` un hash BCrypt conocido **solo en esta base descartable** (generado con `htpasswd -bnBC 10 "" <pass>`, cambiando `$2y` por `$2a`) y exportar `E2E_PASSWORD`. Anotar en la Bitácora cuál camino se tomó.
  4. Correr `python3 scripts/e2e/api_smoke.py` y después `cd frontend && E2E_BASE_URL=http://127.0.0.1:18080 npx playwright test`.
  5. **Siempre** (con `trap`): `docker compose -p gestion-eventos-mvp-e2e down -v`. Opción `--keep` para depurar.
  6. Exit code ≠0 si falla cualquiera de los dos E2E.
  - Documentado en `AGENTS.md` y en `DOCKER.md`.
- [x] **E4 · Correr `scripts/e2e/run.sh` completo** y pegar el resumen PASS/FAIL en la Bitácora. Si algo falla por un bug de la app, se corrige con un commit `fix(E4-<n>)` y se vuelve a correr hasta que todo esté en verde.

### Fase F — Verificación final integral
- [x] **F1 ·** `cd backend && ./mvnw test`: todo en verde, incluido `ModuleBoundariesTest`. Anotar la cantidad de tests.
- [x] **F2 ·** `cd frontend && npx tsc -b && npm run build && npx eslint .`: build OK. El total de errores de lint tiene que ser **menor o igual a 63**; anotar el número.
- [x] **F3 ·** `scripts/e2e/run.sh`: todo en verde (API y navegador).
- [x] **F4 · Lector frío.** Un agente nuevo, sin este historial, lee solo `AGENTS.md` y lo que enlaza, y responde. Cualquier respuesta dudosa o incorrecta obliga a corregir el doc y repetir.
  1. ¿Qué cliente HTTP uso para un endpoint nuevo?
  2. ¿Qué número lleva una migración nueva y puedo editar V14?
  3. ¿Puedo inyectar `EventRepository` en `requests`? ¿Qué hago si lo necesito?
  4. ¿Dónde declaro un evento de dominio nuevo?
  5. ¿Quién resuelve un conflicto de prioridad?
  6. ¿Qué eventos se pueden editar?
  7. ¿Cómo veo los correos en Docker?
  8. ¿Cómo corro el E2E?
  9. ¿Qué hago con `synthetic-user-engine/`?
  10. ¿Qué pasos implica cambiar un permiso?
- [ ] **F5 · grep final.** `grep -rnE "SOLICITADO|CANCELLED|/internal/|KEEP_NEW|KEEP_DISPLACED|MIXTO|MailHog"` sobre `backend/src frontend/src docs *.md` no da resultados fuera de `db/migration/V1..V14`, `docs/historial/` y el test negativo de `CANCELLED` en `PriorityConflictAccessIntegrationTest`. Cerrar la Bitácora con un resumen. Pendiente: los únicos hits restantes son autorreferencias activas en el `plan.md`; el comentario obsoleto `Status` en source se corrigió en `69671e3`. No declarar pase final ni archivar/quitar este plan hasta completar F5.

---

## 4. Archivos críticos (resumen)
- **Backend:**
  - `pom.xml`, `application.yml`, `application-test.yml`;
  - `feature/events/service/EventService.java`;
  - `feature/requests/controller/AdminEventRequestController.java`;
  - `feature/users/model/User.java`;
  - `feature/priority/{event,service}`;
  - los 5 servicios con `getCurrentUser()`;
  - nuevo `src/test/.../architecture/ModuleBoundariesTest.java`.
- **Frontend:**
  - `vite.config.ts`, `eslint.config.js`, `package.json`, `playwright.config.ts`, `e2e/`;
  - `services/api/types/backend.types.ts`, `services/api/client/config.ts`;
  - `services/api/{events,priority,tech,users,public-events,availability,catalogs,audit,comments}.ts`;
  - `store/{publicRequests,catalogs,index}.ts`;
  - `features/public/components/{PublicEventForm,PublicAudienceTypeSelect}.tsx`;
  - `features/events/utils/*`;
  - `src/utils/{request-sorting,event-status}.ts`.
- **Infra, scripts y docs:**
  - `docker-compose.yml`, nuevo `docker-compose.mail-access.yml`, `.env.example`, `frontend/.env.example`;
  - `scripts/e2e/{api_smoke.py,run.sh}`;
  - `AGENTS.md`, `CLAUDE.md`, `DOCKER.md`, los READMEs, `docs/{arquitectura,permisos,decisiones-funcionales,backlog}.md`, `docs/historial/`.

## 5. Revisión (Claude, al terminar Codex)
- Contrastar `git log 2de6235..HEAD` con los checkboxes y la Bitácora: un commit por ítem y los motivos de cualquier bloqueo.
- `/code-review` desde `2de6235` (estándares + spec contra este plan).
- Re-ejecutar F1–F5 y `scripts/e2e/run.sh`.
- Las correcciones van en commits `fix(review-<ID>)`.

## 6. Bitácora (la completa el ejecutor)
| ID | Commit | Verificación corrida | Notas / grep de consumidores / BLOQUEADO |
|---|---|---|---|
| A1 | `e5cd588` | `cd backend && JAVA_HOME=$(/usr/libexec/java_home) ./mvnw -q test` (18 suites, 39 tests, 0 failures/errors/skips); `JAVA_HOME=$(/usr/libexec/java_home) ./mvnw -q -DskipTests package`; `jar tf target/backend-0.0.1-SNAPSHOT.jar | grep -c h2` → `0` | H2 quedó en scope `test`; se eliminaron `spring.h2.console.*` y `spring.security.user`. `grep -c` devuelve exit 1 por cero coincidencias, resultado esperado. |
| A2 | `4ccc845` | `cd frontend && npx tsc -b && npm run build` (OK); ESLint worktree vs `HEAD`: 2 vs 2 errores en `PublicEventForm.tsx` | El formulario usa `checkPublicAvailability`; conflictos sin título muestran “Evento existente”. Chequeo HTTP 200 sin sesión pendiente de E1; todavía no se marca completo. |
| A3 | `140dc51` | `cd frontend && npx tsc -b && npm run build` (OK); ESLint worktree vs `HEAD`: 0 vs 0 en los seis archivos modificados; `grep -rn 'MIXTO' frontend/src` sin resultados | `TERCERA_EDAD` y “Tercera edad” añadidos y alineados con `AudienceType` Java; bundle-size warning de Vite no bloqueó el build. |
| A4 | `795fd61` | `cd frontend && npx tsc -b && npm run build` (OK); ESLint worktree vs `HEAD`: 0 vs 0 en `publicRequests.store.ts` | Rechazadas/convertidas se actualizan en el lugar; no había test específico del store. Build tuvo advertencia de bundle grande. |
| A5 | `81e9aa8` | `cd backend && JAVA_HOME=$(/usr/libexec/java_home) ./mvnw -q test` (19 suites, 41 tests, 0 failures/errors/skips); `cd frontend && npx tsc -b && npm run build` (OK); ESLint worktree vs `HEAD`: 0 vs 0 en los tres archivos frontend | Test de edición cubre RECHAZADO→400 y APROBADO→200 con transición a EN_REVISION. Se alinearon todos los helpers de edición; Vite mantiene advertencia de bundle grande. |
| A6 | `337e19b` | `cd frontend && npx tsc -b && npm run build` (OK); `docker compose -f docker-compose.yml -f docker-compose.mail-access.yml config` (OK); `git diff --check` | Vite proxy, defaults y Mailpit override confirmados por Compose renderizado; no se levantaron servicios ni se probó entrega real de mail. |
| A7 | `2858cac` | `cd backend && JAVA_HOME=$(/usr/libexec/java_home) ./mvnw -q test` (19 suites, 41 tests); `cd frontend && npx tsc -b && npm run build` (OK); ESLint worktree vs `HEAD`: 0 vs 0 en cuatro archivos; `grep -rn 'myEventsOnly' frontend/src` sin resultados | Filtrado oculto eliminado porque no había UI; la hidratación descarta la clave persistida antigua y conserva los otros filtros. Build tuvo advertencia de bundle grande. |
| B1 | `e27d98a` | `grep -rn`/`grep -rnF` de rutas y símbolos en `frontend/src backend/src`; no se borraron archivos ni se corrió build/test | BLOQUEADO: `services/api/{spaces,departments,calendar}.ts` importan y usan `services/http/client.ts`, todos candidatos del grupo B1. Se detuvo antes de borrar; se continúa con B2 según instrucción del usuario. |
| B2 | `bbc8f1b` | Greps de consumidores sobre los targets B2 en `frontend/src backend/src`; no se borraron archivos ni se corrieron pruebas | BLOQUEADO: `CalendarPage.OLD.tsx` importa y llama `useCalendarEvents` y funciones de `calendar.service.ts`, también candidatos del grupo B2. No se borró nada; se continúa con B3 según instrucción del usuario. |
| B3 | `2436811` | `cd frontend && npx tsc -b && npm run build` (OK); ESLint worktree vs `HEAD`: 3 vs 3 en `store/index.ts`; `git diff --check` (OK) | Se quitó solo el slice UI sin lectores y se migró v0→v1 eliminando `sidebarOpen`; slices `calendar`/`events` se documentaron como legacy por lectores activos. No hay test dedicado de migración persistida. |
| B4 | `f70001f` | `cd frontend && npx tsc -b && npm run build` (OK); ESLint worktree vs `HEAD`: 1 vs 1 en `catalogs.api.ts`, 0 vs 0 en otros siete archivos; grep de símbolos falsos sin resultados; `services/api/priority.ts` sin cambios | Eliminados contratos, acciones y tipos falsos de prioridad; alertas siguen usando `services/api/priority.ts`. Bundle-size warning no bloqueó el build. |
| B5 | `7c77462` | Greps de consumidores en `frontend/src backend/src`; no se modificaron archivos ni se corrieron build/tests | BLOQUEADO: `availability.store.ts:103` consume `availabilityApi.getTechCapacity`; `hasTechCapacity` y `getTopUtilizedBlocks` también la llaman internamente. Otros métodos candidatos no eliminados mientras el gate estuvo activo. |
| B6 | `14c3e9f` | `cd frontend && npx tsc -b && npm run build` (OK); ESLint: ningún archivo empeora vs `HEAD` (PublicEventForm 1/2; otros 0/0 salvo catalogs.api 1/1); grep de §B6 sin resultados; revisión cruzada con DTOs Java | Se alinearon estados/payloads de solicitudes, disponibilidad/ocupación, comentarios y conflictos; JSDoc ya no promete filtros/campos no soportados. Build no valida llamadas API reales; no hay test frontend de contrato runtime. |
| B7 | `061fa34` | `cd frontend && npx tsc -b && npm run build` (OK); ESLint: ningún archivo empeora; `grep -rln 'lib/http' frontend/src` deja solo `features/auth/*`; ambos clientes usan `accessToken` | Migración preserva refresh 401 con cola/reintento; no hay tests de refresh concurrente/fallo. `services/http/client.ts` y `audit.api.ts` conservan lecturas legacy de `token`, fuera de los dos clientes tratados; B1 sigue bloqueado. |
| B8 | `15da181` | `JAVA_HOME=$(/usr/libexec/java_home) ./mvnw -q test` (OK; 19 suites, 41 tests, 0 failures/errors/skips); `git diff --check` (OK); grep de consumers del evento y de `getCurrentUser()` | Se quitó import sin uso, evento sin consumidores y publisher; se centralizó resolución de usuario en `CurrentUserService`. `PriorityConflictEvent` y listener de notificaciones permanecen. Sin tests focalizados para variantes de principal/atribución. |
| B9 | `afbe5db` | `cd frontend && npx tsc -b && npm run build` (OK); ESLint en 11 archivos tocados: 0 errores, igual que baseline; grep de rutas antiguas sin resultados; `git diff --check` (OK) | Los helpers de sorting y estado ahora viven en `src/utils`; imports revisados y sin ciclos o dependencias de utils hacia features. Bundle mantiene advertencia >500 kB. |
| C1 | `cb22a8b` → `5e5de2d` | Guardas ArchUnit instaladas y verificadas; probes negativos: EventRepository en TechCapacityController → Regla 3; DepartmentRepository temporal en TechCapacityService → solo Regla 2 (tech→catalogs ya existe); UserRepository desde tech → Reglas 1 y 2; campo `shared.Priority` temporal en BackendApplication → Regla 1. Todos los probes se revirtieron. Antes de C1: 20 suites/42 tests; tras C1: focalizados 4/4 y suite completa 46 tests, 0 fallos/errores/skips, incluido ModuleBoundariesTest | C1 quedó resuelto sin allowlist nueva. `PriorityConflictController` ahora obtiene la proyección mediante `PriorityConflictService`; se conserva el contrato existente de `EventService.getOpenConflicts`, que devuelve entidades. |
| C2 | `302366d` | `cd frontend && npx tsc -b && npm run build` (OK); ESLint reporta 61 errores y 7 warnings actuales; implementador informa ninguna violación en estas zonas; prueba negativa desde `services/api` → lint exit 1; `git diff --check` (OK) | Se generaron restricciones por feature con excepción auth y mensaje a `docs/arquitectura.md#frontend`. El lint global permanece rojo; no se debilitó. La revisión estática no sustituyó evidencia de ejecución. |
| D1 | `557cb6f` | `git check-ignore -v` verifica `.atl/`, `artifacts/` y `synthetic-user-engine/`; `git diff --check` (OK); auditoría confirmó que ambas carpetas de datos se conservaron | Se quitaron solo `.atl/` y los dos directorios ignorados de salida de herramientas indicados en el plan. No se borró contenido de `artifacts/` ni `synthetic-user-engine/`. |
| D2 | `df22516` | Revisión de documentación frente a las secciones (a–h) y fuentes actuales; `git diff --check` (OK); no se ejecutaron tests ni renderer | Se creó mapa de módulos/imports/deuda y guías. Al registrar D2, el grafo era un scan de imports, no salida validada de ArchUnit; C1 seguía bloqueado en ese momento. |
| D3 | `12159b7` | Revisión independiente contra los requisitos; `git diff --check` (OK); comandos y rutas contrastados con scripts/repositorio | `AGENTS.md` quedó como guía canónica y `CLAUDE.md` referencia solo `@AGENTS.md`. Runner E2E aún no existe; se añadió invocación condicional después de E3. `docs/historial/` conserva documentos versionados no vigentes. |
| D4 | `caa958f` | Revisión independiente contra `SecurityConfig`, tests y rutas frontend; `git diff --check` (OK); no se corrieron tests | `docs/permisos.md` declara fuente de verdad documental, lista rutas públicas y agrega checklist de cambios. Cobertura existente es más acotada que la matriz (Actuator readiness verificado, no todo Swagger/info). |
| D5 | `8389426` | Revisión independiente de §1.3, servicios de edición, helpers UI y API de conflictos; `git diff --check` (OK); no se corrieron tests | Las cuatro decisiones quedaron como cerradas; regla de edición confirmada; pantalla de conflictos separada bajo `Alcance futuro`; IDs como referencias parentéticas. |
| D6 | `9830d43` | `rg -F 'docs/hallazgos-estado.md'` sin resultados; `git diff --check` (OK); revisión independiente confirma referencias y claims corregidos | Ledger movido a `docs/historial/`, marcado no normativo; se eliminaron preguntas ya resueltas y “próxima migración libre”. La carpeta del simulador sigue siendo legacy ignorada; la contraseña seed no se verificó en vivo. |
| D7 | `7a5d0f7` | Revisión independiente contra controller, DTOs, service, SecurityConfig, tests y docs; `git diff --check` (OK); no se corrieron tests | Backlog incluye permisos/contratos/paginación real, criterios verificables, deuda ordenada y actualización condicional del simulador. Al registrar D7, C1 aún estaba bloqueado; tests existentes no cubren todo el flujo futuro. |
| D8 | `c1d498f` | Revisión independiente de Compose, variables, seed y plan; `git diff --check` (OK); Docker no se levantó. E1/E4 posteriores verifican el login y el runner aislado | DOCKER.md actualizado; los prerrequisitos E1/E3/E4 quedaron verificados posteriormente. |
| D9 | `8c113be` | Ambos READMEs tienen 25 líneas, enlaces y comandos verificados; `git diff --check` (OK); revisión independiente corrigió la descripción del puerto backend | Boilerplate Vite reemplazado y guía backend añadida. `127.0.0.1:8080` es la entrada UI/Nginx; backend interno escucha en 9090. |
| E1 | `bd74d08` | Ejecución final post-C1 en `scripts/e2e/run.sh` (HEAD `5e5de2d`): 16/16 casos API aprobados; cleanup del stack y volumen descartables verificados | El smoke pasó por nginx; login semilla `admin123`, disponibilidad pública y contratos API comprobados en el entorno aislado. |
| E2 | `fafa2d4` + `e72274c`, `d1bb60f`, `d7f4283`, `60a1518` | Ejecución final post-C1 en `scripts/e2e/run.sh` (HEAD `5e5de2d`): 3/3 tests Playwright aprobados | Specs públicos/admin/viewer ejecutados; se corrigieron nombres/roles accesibles y locators obsoletos. Cleanup verificado. `npm install` reportó 27 vulnerabilidades (3 moderadas, 22 altas, 2 críticas); no se compararon con baseline ni se ejecutó `npm audit`. |
| E3 | `84e9091` | Run final post-C1 `5e5de2d`: E1 16/16, E2 3/3; preflight local, aislamiento y cleanup verificados | Runner fijo al socket local y proyecto `gestion-eventos-mvp-e2e`; backend/MySQL no publican puertos de host. |
| E4 | `e37a857`, `e72274c`, `d1bb60f`, `d7f4283`, `60a1518` | `scripts/e2e/run.sh`, ejecución post-C1 en HEAD `5e5de2d`: E1 16/16 y E2 3/3; cleanup verificado | Fallos iniciales corregidos mediante commits específicos; ejecución completa final verde. Los endpoints `/api/priority/conflicts` no fueron llamados por estos recorridos. |
| F1 | `5e5de2d` | Antes de C1: 20 suites/42 tests; tras C1: test focalizado 4/4 y suite completa 46 tests, 0 fallos/errores/skips, incluido `ModuleBoundariesTest` | Verificación backend completa en verde con la guarda de arquitectura presente; probes negativos documentados en C1. |
| F2 | — | `npx tsc -b` y `npm run build` OK; `npx eslint .`: 61 errores y 7 warnings, dentro del umbral ≤63 | El build/typecheck pasan; ESLint conserva errores preexistentes sin exceder el límite del plan. |
| F3 | `5e5de2d` | `scripts/e2e/run.sh`: E1 16/16; E2 3/3; cleanup verificado | E2E API y navegador verdes tras C1 en el código fuente; los recorridos no ejercitan las respuestas del GET de conflictos. |
| F4 | — | Lector frío respondió las 10 preguntas de §F4 sin incertidumbre, tanto antes como después de actualizar el estado C1 | La guía y los documentos enlazados permitieron resolver el cuestionario; la segunda lectura confirmó que no queda lenguaje que llame bloqueado a C1. |
