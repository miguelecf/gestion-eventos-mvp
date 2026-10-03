# Guía del proyecto

Guía canónica para trabajar en Gestión de Eventos (TFI UNLa). Seguí primero el [plan activo](plan.md), en especial su protocolo (§0).

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

El build de frontend también ejecuta `tsc -b`. Para archivos con errores previos, comparar el número de errores de ESLint contra el mismo archivo en `HEAD`; no agregar errores nuevos. El runner Playwright/API de Fase E todavía no está establecido: `scripts/e2e/run.sh`, `frontend/playwright.config.ts` y `frontend/e2e/` no existen. Cuando E3 lo cree y verifique, ejecutar `bash scripts/e2e/run.sh`.

## Dónde están las reglas

| Tema | Fuente de verdad |
|---|---|
| Permisos de rutas y roles | [docs/permisos.md](docs/permisos.md); `backend/.../config/SecurityConfig.java` es la autoridad de autorización efectiva. |
| Decisiones de negocio | [docs/decisiones-funcionales.md](docs/decisiones-funcionales.md) y §1.3 de [plan.md](plan.md). |
| Módulos, dependencias y convenciones de arquitectura | [docs/arquitectura.md](docs/arquitectura.md). |
| Estado e historial de hallazgos | [docs/hallazgos-estado.md](docs/hallazgos-estado.md); se moverá a `docs/historial/` según D6. |
| Compose, migraciones locales y correo | [DOCKER.md](DOCKER.md). |
| Secuencia, alcance, cortes y evidencia de este trabajo | [plan.md](plan.md), especialmente §0 y §6 (Bitácora). |

## Reglas de trabajo

- Trabajá los ítems del plan en orden. **Un ítem = un commit convencional**: `<tipo>(<ID>): <resultado>`. No crear ramas ni hacer push; no reescribir commits existentes.
- Cada test de integración backend nuevo debe extender `backend/src/test/java/com/mvp/backend/support/IntegrationTestBase`. Incluye helpers de autenticación/fixtures; un test `@Transactional` no dispara listeners `AFTER_COMMIT`.
- En frontend, correr typecheck/build y lint por archivo. El archivo tocado no debe sumar errores de lint respecto de `HEAD`.
- Para una migración, consultar el último nombre con `ls backend/src/main/resources/db/migration | sort -V | tail -1` y usar el siguiente número Flyway. **Nunca editar una migración existente o aplicada**: corregir con una nueva migración y actualizar la entidad cuando corresponda.
- El código legacy se puede corregir o eliminar si la evidencia demuestra que está mal o muerto. Antes de eliminarlo, buscar consumidores y registrar el resultado; si hay consumidores o se activa un corte del plan, detener ese ítem y dejar constancia.
- No versionar ni revisar como fuente vigente estos contenidos locales/de historial: `artifacts/` y `synthetic-user-engine/` (contrato viejo). `docs/historial/` conserva documentos versionados que ya no son la fuente vigente.

**Plan activo:** [`plan.md`](plan.md). Al terminar el plan, moverlo a `docs/historial/` y quitar esta línea.
