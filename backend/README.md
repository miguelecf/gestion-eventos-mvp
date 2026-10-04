# Gestión de Eventos — Backend
Spring Boot 3.5 / Java 17 API for event requests, scheduling, authorization, and administration.
## Run
From the repository root, start the full application and MySQL dependency:
```bash
docker compose up --build
```

Open the full-stack UI at `http://127.0.0.1:8080`; its proxy routes API requests to the backend container on port `9090`. See [DOCKER.md](../DOCKER.md) for local configuration.

## Maven commands (from `backend/`)

- `./mvnw -q test` — unit and integration tests (H2 test profile).
- `./mvnw -q package` — build the executable JAR.
- `./mvnw spring-boot:run` — run locally with datasource and required environment configured.

## Structure

- `src/main/java/com/mvp/backend/feature/` — business modules, including `events`, `requests`, and `auth`.
- `shared/` and `config/` — cross-cutting infrastructure; `src/main/resources/db/migration/` — Flyway migrations.
- `src/test/java/` — unit and integration tests.

## Guidance

[Repository instructions](../AGENTS.md) · [Architecture and module boundaries](../docs/arquitectura.md) · [Local stack](../DOCKER.md)
