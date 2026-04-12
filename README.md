# PowerSync Postgres + TanStack DB Starter

A minimal starter template for a self-hosted `Postgres + PowerSync + TanStack DB` stack.

Looking for the TanStack Start version? See the [`tanstack-start-server-functions`](https://github.com/powersync-community/postgres-tanstack-db-starter/tree/tanstack-start-server-functions) branch.

This repo uses the same shape as the PowerSync workbench examples:

- Dockerized PostgreSQL with logical replication enabled
- A self-hosted PowerSync service pointed at that database
- A custom backend that issues PowerSync JWTs and applies queued writes
- A Vite + React + TanStack DB frontend backed by PowerSync local SQLite

## Stack

- Frontend: React 19 + Vite + TypeScript
- Local-first sync: `@powersync/web` + `@powersync/react`
- Reactive collections: `@tanstack/react-db` + `@tanstack/powersync-db-collection`
- Backend: Hono + PostgreSQL
- Infra: Docker Compose for Postgres and PowerSync

## Quick Start

1. Copy the local environment file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pnpm install
```

3. Start PostgreSQL + PowerSync:

```bash
pnpm db:up
```

4. Start the frontend and backend:

```bash
pnpm dev
```

5. Open `http://localhost:5173`

## Services

- React app: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- PowerSync: `http://localhost:8080`
- Postgres: `localhost:5432`

## Useful Commands

```bash
pnpm db:logs        # Follow Postgres + PowerSync logs
pnpm db:down        # Stop services and remove volumes
pnpm db:reset       # Recreate the database from scratch
pnpm typecheck      # Run TypeScript checks for app + server
pnpm build          # Build the app + server
pnpm powersync:token
```

## How It Works

1. The frontend creates TanStack DB collections on top of a PowerSync-backed SQLite database.
2. `fetchCredentials()` asks the backend for a PowerSync JWT.
3. PowerSync syncs `lists` and `todos` from Postgres using Sync Streams.
4. Local writes are queued in SQLite.
5. `uploadData()` posts queued CRUD operations to the backend.
6. The backend writes them to Postgres in a transaction.
7. PowerSync replicates those changes back down to every client.

## Project Layout

```text
.
├── app/                # React + TanStack DB frontend
├── postgres/init/      # Postgres schema + seed data
├── powersync/          # PowerSync self-hosted config
├── server/             # Token endpoint + upload API
└── docker-compose.yml  # Local Postgres + PowerSync stack
```

## Production Notes

- The template uses a development HS256 key so it stays copy-paste runnable. Replace it with your real auth flow before shipping.
- The upload endpoint uses a strict table allowlist, but it still assumes a trusted local client. Add real authentication and authorization in production.
- Keep your Postgres schema, `powersync/sync-config.yaml`, and the client schema in `app/src/lib/powersync/schema.ts` aligned.
