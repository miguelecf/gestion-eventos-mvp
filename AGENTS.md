# Guía del proyecto

Guía canónica para trabajar en Gestión de Eventos (TFI UNLa).

## Proyecto y stack

Aplicación institucional de gestión de eventos: el público solicita eventos sin iniciar sesión; las áreas internas revisan y gestionan solicitudes y eventos.

- **Backend (`backend/`)**: Spring Boot 3.5.5, Java 17, Maven Wrapper, JPA, MySQL, Flyway y Spring Security/JWT.
- **Frontend (`frontend/`)**: React 19, Vite 7 y TypeScript; Zustand, React Hook Form/Zod, Tailwind 4, CASL y FullCalendar.
- **Entorno local**: Docker Compose. Ver [DOCKER.md](DOCKER.md) para servicios, puertos y datos.

## Comandos verificados

Ejecutar desde la raíz del repositorio, salvo que se indique otra cosa:

```bash
# Tests backend (incluye tests de integración)
cd backend && JAVA_HOME=$(/usr/libexec/java_home) ./mvnw -q test

# Typecheck y build frontend
cd frontend && npx tsc -b && npm run build

# Lint enfocado; repetir para cada archivo tocado
cd frontend && npx eslint src/ruta/al/archivo.tsx
```

Si Maven falla con `cannot find symbol` sobre getters/builders de Lombok, un JDT LS sin el javaagent de Lombok compiló en `target/`: correr `./mvnw clean test` (ver [docs/registro-cambios.md](docs/registro-cambios.md#incidencias-de-entorno)). El build de frontend también ejecuta `tsc -b`. Para archivos con errores previos, comparar el número de errores de ESLint contra el mismo archivo en `HEAD`; no agregar errores nuevos. Para ejecutar E1 y E2 contra el stack descartable, usá `bash scripts/e2e/run.sh` desde la raíz; requiere que `DOCKER_HOST` y `DOCKER_CONTEXT` no estén definidos y valida que el contexto seleccionado use un socket Unix local. Fija las conexiones a recursos internos/puertos locales, serializa ejecuciones concurrentes y por defecto elimina exclusivamente el proyecto `gestion-eventos-mvp-e2e` y sus volúmenes al salir. `--keep` conserva ese stack para depuración; ante un lock obsoleto, verificá que no haya un runner activo antes de quitarlo. No apuntes el runner a datos locales, compartidos ni de producción.

## Dónde están las reglas

| Tema | Fuente de verdad |
|---|---|
| Permisos de rutas y roles | Matriz única `frontend/src/libs/permisos.json` (la leen CASL y `PermissionMatrixIntegrationTest`), explicada en [docs/permisos.md](docs/permisos.md); `backend/.../config/SecurityConfig.java` es la autoridad de autorización efectiva. |
| Decisiones de negocio | [docs/decisiones-funcionales.md](docs/decisiones-funcionales.md). |
| Registro de decisiones (qué, por qué, consecuencias) | [docs/adr.md](docs/adr.md). Cada decisión nueva de un ticket suma una entrada; una decisión no se edita, se reemplaza. |
| Módulos, dependencias y convenciones de arquitectura | [docs/arquitectura.md](docs/arquitectura.md). |
| Compose, migraciones locales y correo | [DOCKER.md](DOCKER.md). |
| Bitácora de tickets `SEC-xx` (fecha, commit, verificación) | [docs/registro-cambios.md](docs/registro-cambios.md). |

## Reglas de trabajo

- Cuando se acuerde un plan de trabajo, ejecutar sus ítems en orden. **Un ítem = un commit convencional**: `<tipo>(<ID>): <resultado>`. No crear ramas ni hacer push; no reescribir commits existentes.
- Al cerrar un ticket del sistema externo (`SEC-xx`), agregar una fila al log de [docs/registro-cambios.md](docs/registro-cambios.md) con fecha y hora del commit, hash, cambio y verificación, más su sección de detalle.
- Cada test de integración backend nuevo debe extender `backend/src/test/java/com/mvp/backend/support/IntegrationTestBase`. Incluye helpers de autenticación/fixtures; un test `@Transactional` no dispara listeners `AFTER_COMMIT`.
- En frontend, correr typecheck/build y lint por archivo. El archivo tocado no debe sumar errores de lint respecto de `HEAD`.
- Para una migración, consultar el último nombre con `ls backend/src/main/resources/db/migration | sort -V | tail -1` y usar el siguiente número Flyway. **Nunca editar una migración existente o aplicada**: corregir con una nueva migración y actualizar la entidad cuando corresponda.
- El código legacy se puede corregir o eliminar si la evidencia demuestra que está mal o muerto. Antes de eliminarlo, buscar consumidores y registrar el resultado; si hay consumidores o se activa un corte del plan, detener ese ítem y dejar constancia.
- No versionar `artifacts/` (contenido local).
- `synthetic-user-engine/` es el motor de usuarios sintéticos ([README](synthetic-user-engine/README.md)): recorre la aplicación por HTTP y verifica reglas de negocio. Un cambio de contrato de la API (rutas, DTOs, códigos, roles) debe actualizar sus recorridos en el mismo ítem. Correrlo contra el stack E2E (`--base-url http://127.0.0.1:18080 --mailpit-url http://127.0.0.1:18025`), no contra datos ajenos.
