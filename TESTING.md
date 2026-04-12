# Testing

This document captures how the starter was verified end to end.

## What Was Verified

- Postgres starts with the expected schema and seed data
- PowerSync starts and reports healthy readiness probes
- The backend serves:
  - `GET /api/health`
  - `GET /api/auth/token`
  - `POST /api/powersync/upload`
- The frontend loads and connects to PowerSync
- Seeded rows sync into the browser
- New rows created in the browser are queued locally, uploaded through the backend, and persisted in Postgres
- Updates made in the browser are persisted back to Postgres

## Local Environment Used

- Repo: `powersync-community/postgres-tanstack-db-starter`
- Frontend preview: `http://127.0.0.1:4173`
- Backend API: `http://localhost:3001`
- PowerSync: `http://localhost:8080`
- Postgres: `localhost:5432`

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Start Infrastructure

```bash
docker compose up -d
```

Expected result:

- `postgres` container becomes healthy
- `powersync` container becomes healthy

Useful check:

```bash
docker compose ps
```

## 3. Start Backend And Frontend

Backend:

```bash
pnpm --dir server start
```

Frontend preview:

```bash
pnpm --dir app build
pnpm --dir app preview --host 127.0.0.1 --port 4173
```

Notes:

- During testing, the built frontend initially pointed at the wrong backend origin because it had been built with stale env values.
- Rebuilding the app after confirming `.env` fixed that issue.

## 4. Verify Health Endpoints

Backend health:

```bash
curl -sSf "http://localhost:3001/api/health"
```

Expected response:

```json
{"ok":true}
```

PowerSync liveness:

```bash
curl -sSf "http://localhost:8080/probes/liveness"
```

PowerSync readiness:

```bash
curl -sSf "http://localhost:8080/probes/readiness"
```

Expected readiness/liveness response shape:

```json
{"ready":true,"started":true,"touched_at":"..."}
```

Frontend availability:

```bash
curl -sSf "http://127.0.0.1:4173"
```

Expected result:

- HTML for the starter app is returned

## 5. Verify Backend API Paths Without The Browser

Fetch a PowerSync token:

```bash
curl -sSf "http://localhost:3001/api/auth/token?user_id=demo-user"
```

Expected result:

- JSON containing `token`, `powersyncUrl`, and `userId`

Verify the upload API by sending a PowerSync-style CRUD payload:

```bash
curl -sSf -X POST "http://localhost:3001/api/powersync/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "operations": [
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "op": "PUT",
        "table": "lists",
        "opData": {
          "owner_id": "demo-user",
          "name": "Hono verification list",
          "created_at": "2026-04-11T00:00:00.000Z"
        }
      }
    ]
  }'
```

Expected response:

```json
{"success":true}
```

Confirm it reached Postgres:

```bash
docker compose exec -T postgres psql -U postgres -d powersync_tanstack \
  -c "SELECT id, name FROM lists WHERE id = '22222222-2222-2222-2222-222222222222';"
```

Expected result:

```text
22222222-2222-2222-2222-222222222222 | Hono verification list
```

## 6. Browser End-To-End Test

Playwright was used to verify the real UI and sync flow.

### Browser Assertions

The browser test checked that:

- the app shell renders
- PowerSync reaches a connected state
- seeded rows appear in the UI
- a new list can be created from the UI
- a new todo can be created from the UI
- the todo can be toggled complete in the UI

### Seed Data Confirmation

After the frontend was rebuilt with the correct env values, the browser showed synced data including:

- `Launch checklist`
- `Ideas inbox`
- `Verification list`

This proved that:

- frontend -> token endpoint works
- frontend -> PowerSync connection works
- PowerSync -> Postgres replication works
- TanStack DB collections are rendering synced rows

### Browser-Created Data Confirmation

The Playwright run created:

- list: `Playwright list 824498`
- todo: `Playwright todo 824498`

Then it marked that todo complete.

The database was checked directly afterward:

```bash
docker compose exec -T postgres psql -U postgres -d powersync_tanstack \
  -c "SELECT l.name AS list_name, t.description AS todo_name, t.completed FROM lists l LEFT JOIN todos t ON t.list_id = l.id WHERE l.name = 'Playwright list 824498';"
```

Observed result:

```text
Playwright list 824498 | Playwright todo 824498 | t
```

That is the strongest end-to-end proof for this starter:

- browser created data locally
- PowerSync queued the write
- backend applied it
- Postgres stored it
- the update state (`completed = true`) also persisted

## 7. Typecheck And Build Verification

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

Because of that, the JWT-related service config values had to use:

- `PS_JWT_AUDIENCE`
- `PS_JWT_ISSUER`
- `PS_JWT_KID`
- `PS_JWT_SECRET`
- `PS_JWT_SECRET_B64`

### 2. Frontend build used stale env values

The built frontend initially returned this browser-visible error:

```text
Download error: Unexpected token '<', "<!doctype "... is not valid JSON
```

Root cause:

- `fetchCredentials()` was hitting the wrong origin and receiving HTML instead of the backend JSON response

Fix:

- rebuild the frontend after confirming `.env`

```bash
pnpm --dir app build
```

### 3. PowerSync web build config

The app required the Vite worker configuration and `esnext` target to build correctly with `@powersync/web`.

That is already baked into `app/vite.config.ts`.

## Recommended Repeatable Test Flow

For future verification, this is the shortest useful flow:

1. `pnpm install`
2. `docker compose up -d`
3. `pnpm --dir server start`
4. `pnpm --dir app build`
5. `pnpm --dir app preview --host 127.0.0.1 --port 4173`
6. `curl http://localhost:3001/api/health`
7. `curl http://localhost:8080/probes/readiness`
8. open `http://127.0.0.1:4173`
9. confirm seeded lists appear
10. create a list and todo in the UI
11. verify the created records in Postgres with `psql`

## Artifacts From Verification

- UI screenshot: `/tmp/powersync-starter-e2e.png`
- browser diagnosis screenshot: `/tmp/powersync-starter-diagnose.png`
