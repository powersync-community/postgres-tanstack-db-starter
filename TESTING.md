# Testing

This document captures the current verification flow for the TanStack Start variant of the starter.

## What Was Verified

- Postgres starts with the expected schema and seed data
- PowerSync starts and reports healthy readiness probes
- The TanStack Start app builds successfully
- The frontend loads and connects to PowerSync
- Seeded rows sync into the browser
- New rows created in the browser are queued locally, applied by TanStack Start server functions, and persisted in Postgres
- Updates made in the browser are persisted back to Postgres

## Local Environment Used

- Repo: `powersync-community/postgres-tanstack-db-starter`
- App URL: `http://localhost:3001`
- PowerSync: `http://localhost:8080`
- Postgres: `localhost:5432`

## Verification Flow

1. Install dependencies:

```bash
pnpm install
```

2. Start infrastructure:

```bash
pnpm db:up
```

3. Start the app:

```bash
pnpm dev
```

4. Verify PowerSync is healthy:

```bash
curl -sSf "http://localhost:8080/probes/readiness"
```

5. Open `http://localhost:3001` and confirm:

- the app shell renders
- PowerSync reaches a connected state
- seeded lists and todos appear

6. Create a list and todo in the browser, then confirm they reached Postgres:

```bash
docker compose exec -T postgres psql -U postgres -d powersync_tanstack \
  -c "SELECT l.name AS list_name, t.description AS todo_name, t.completed FROM lists l LEFT JOIN todos t ON t.list_id = l.id ORDER BY l.created_at DESC, t.created_at DESC LIMIT 10;"
```

## Typecheck And Build Verification

TypeScript verification:

```bash
pnpm typecheck
```

Build verification:

```bash
pnpm build
```

Expected result:

- both commands complete successfully

## Gotchas Found During Testing

### 1. PowerSync env substitution rules

The PowerSync service config only allows `!env` variables that start with `PS_`.

Because of that, the JWT-related service config values must use:

- `PS_JWT_AUDIENCE`
- `PS_JWT_ISSUER`
- `PS_JWT_KID`
- `PS_JWT_SECRET`
- `PS_JWT_SECRET_B64`

### 2. PowerSync web build config

The app requires the Vite worker configuration and `esnext` target to build correctly with `@powersync/web`.

That is already baked into `vite.config.ts`.

## Recommended Repeatable Test Flow

1. `pnpm install`
2. `pnpm db:up`
3. `pnpm dev`
4. `curl http://localhost:8080/probes/readiness`
5. open `http://localhost:3001`
6. confirm seeded lists appear
7. create a list and todo in the UI
8. verify the created records in Postgres with `psql`
