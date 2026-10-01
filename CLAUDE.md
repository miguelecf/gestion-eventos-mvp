# Gestión de Eventos (TFI UNLa)

Sistema de gestión de eventos institucionales. Hay dos tipos de usuarios:
- **Público, sin login:** pide un evento (`EventRequest`) y lo sigue con un UUID.
- **Áreas internas:** revisan la solicitud, la convierten en `Event` y la aprueban (conformidad ceremonial + técnica).

## Stack
- **Backend** (`backend/`): Spring Boot 3.5.5, Java 17 (compila con el JDK 24 de esta máquina), JPA, MySQL, Flyway, Spring Security con JWT (jjwt), Lombok, springdoc.
- **Frontend** (`frontend/`): React 19, Vite 7, TypeScript, Zustand, react-hook-form + zod, shadcn/Tailwind 4, CASL, FullCalendar.
- **Infra:** `docker compose up --build` y abrir `http://127.0.0.1:8080`; nginx hace proxy de `/api`, `/auth`, `/public` y `/admin` a `backend:9090`. Detalles en `DOCKER.md`.

## Comandos
```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home) ./mvnw test   # perfil test: H2 en memoria, Flyway OFF (schema desde entidades)
cd frontend && npm run build && npm run lint                    # sin runner de tests; lint ya tenía 66 errores previos
```
**Regla de lint:** no agregar errores nuevos. Compará contra la línea base de los archivos que tocaste.

## Backend: convenciones
- Estructura por feature: `feature/<x>/{controller,service,repository,dto,model}`. Los DTO son `record`.
- **Mappers escritos a mano**, como métodos estáticos (`EventMapper`, `EventRequestMapper`). No hay MapStruct.
- **Errores:**
  - `DomainValidationException` → 400 `DOMAIN_VALIDATION_ERROR`
  - `EntityNotFoundException` → 404
  - `ResponseStatusException` para 403/409 con un código en el mensaje
  - Todo se resuelve en `shared/GlobalExceptionHandler`.
- **Seguridad:** las reglas por URL están en `config/SecurityConfig.java` y son la **autoridad**. El contrato está en `docs/permisos.md`.
- **Auditoría:** usar `feature/history/service/AuditService` para todo cambio de negocio de un `Event`.
- **Correo y notificaciones:** se publica un evento con `ApplicationEventPublisher` y lo atiende un `@TransactionalEventListener(AFTER_COMMIT)`.
- **Migraciones:** van en `backend/src/main/resources/db/migration`, con numeración secuencial (la próxima libre está en `docs/hallazgos-estado.md`). En el perfil test no corren, así que una columna nueva también tiene que estar en la entidad.

## Tests de integración
Extender `support/IntegrationTestBase` (en `backend/src/test/java/com/mvp/backend/`):
- siembra un usuario por rol,
- obtiene el JWT con `/auth/login`,
- crea fixtures de espacio y departamento.

Un test anotado con `@Transactional` **no** dispara los listeners `AFTER_COMMIT`.

## Frontend: convenciones
- Cliente HTTP vigente: `src/services/api/*.api.ts` + `client/config.ts` (`ENDPOINTS`).
- Permisos de UI: `src/libs/ability.ts` (CASL), `app/routes.tsx` (`RoleRoute`) y `features/events/hooks/useEventPermissions.ts`. Tienen que reflejar `docs/permisos.md` exactamente.

## Legacy: NO tocar salvo que el hallazgo lo exija
- `src/lib/http.ts` y `src/services/http/client.ts` (clientes HTTP paralelos).
- `useRole.ts` (segundo sistema de roles).
- `CalendarPage.OLD.tsx`.
- Los stores `comments`, `audit` y `availability`, y los slices sin uso.
- `src/hooks/api/*`.

## Flujo de trabajo
- Corrección de hallazgos del reporte técnico; el estado por ID está en `docs/hallazgos-estado.md`.
- **Un commit chico por hallazgo** en la rama actual (`fix(<ID>): ...`). Sin ramas extra.
- Cada fix de backend lleva su test. Sin refactors fuera de alcance.
