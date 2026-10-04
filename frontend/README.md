# Gestión de Eventos — Frontend
React 19 + TypeScript UI for public event requests and internal event management.
## Run

```bash
npm ci
npm run dev
```

Vite proxies API routes to `http://localhost:9090`; start the backend separately, or run `docker compose up --build` from the repository root for the full stack.

## Scripts

- `npm run dev` — start Vite.
- `npm run build` — TypeScript check and production bundle.
- `npm run lint` — run ESLint; `npm run preview` — preview the bundle.

## Structure

- `src/app/` — application entry and routing; `src/features/` — auth, public requests, events, catalogs, users, and dashboard.
- `src/services/api/` — typed API clients; shared UI and state live in `components/`, `hooks/`, and `store/`.

## Guidance

[Repository instructions](../AGENTS.md) · [Architecture and module boundaries](../docs/arquitectura.md) · [Local stack](../DOCKER.md)
