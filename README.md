# PowerSync Postgres + TanStack DB Starter

A minimal starter template for a self-hosted `Postgres + PowerSync + TanStack DB` stack, plus an experimental React Server Components persistence prototype.

The Hono + Vite variant stays on [`main`](https://github.com/powersync-community/postgres-tanstack-db-starter/tree/main).

This repo uses the same shape as the PowerSync workbench examples:

- Dockerized PostgreSQL with logical replication enabled
- A self-hosted PowerSync service pointed at that database
- A TanStack Start app that serves both the UI and server functions
- PowerSync-backed local SQLite collections through TanStack DB

## Stack

- App framework: React 19 + TanStack Start + TypeScript
- Local-first sync: `@powersync/web` + `@powersync/react`
- Reactive collections: `@tanstack/react-db` + `@tanstack/powersync-db-collection`
- Server functions: TanStack Start + PostgreSQL
- Experimental RSC persistence: TanStack Start RSC plugin + `seroval`
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

4. Start the app:

```bash
pnpm dev
```

5. Open `http://localhost:3001`

## Services

- TanStack Start app: `http://localhost:3001`
- PowerSync: `http://localhost:8080`
- Postgres: `localhost:5432`

## Useful Commands

```bash
pnpm db:logs        # Follow Postgres + PowerSync logs
pnpm db:down        # Stop services and remove volumes
pnpm db:reset       # Recreate the database from scratch
pnpm typecheck      # Run TypeScript checks
pnpm build          # Build the TanStack Start app
pnpm powersync:token
```

## How Sync Works

1. The frontend creates TanStack DB collections on top of a PowerSync-backed SQLite database.
2. `fetchCredentials()` calls a TanStack Start server function for a PowerSync JWT.
3. PowerSync syncs `lists` and `todos` from Postgres using Sync Streams.
4. Local writes are queued in SQLite.
5. `uploadData()` calls a TanStack Start server function with queued CRUD operations.
6. The server function writes them to Postgres in a transaction.
7. PowerSync replicates those changes back down to every client.

## RSC + Sync Experiment

This branch is trying to answer one specific question:

> Can a sync engine treat an RSC payload as opaque persisted data, while the server stays owner of component structure and the client only injects interactive slots?

The concrete target is `todos.component`.

- Postgres stores a serialized RSC payload in `todos.component`
- PowerSync replicates that string to the local client database
- The client reads that string and renders it as a todo card
- Interactive bits like checkbox and delete button are provided as client slots
- The server stays owner of card layout, formatting, and data shaping

### Desired Design

The intended model is:

1. Client writes plain row data such as `description`, `completed`, and `completed_at`.
2. Server receives the write and updates canonical Postgres state.
3. Server re-reads the canonical todo row.
4. Server renders a todo RSC payload from that row.
5. Server persists that serialized payload back into `todos.component`.
6. PowerSync syncs the new row shape, including `component`, back to clients.
7. Client renders the synced RSC payload and injects only interactive slot content.

That design matters because it keeps responsibilities clean:

- Postgres remains source of truth
- PowerSync only moves data, including the opaque RSC string
- The client does not own server formatting logic
- The client does not rebuild server component trees locally
- The interactive island stays small and explicit

### Current Prototype

Current code explores a `seroval`-based path:

- `src/lib/rsc.server.ts`
  - serializes TanStack Start RSC values on the server
- `src/lib/rsc.client.ts`
  - deserializes those values in a client-only environment
- `src/lib/server-fns.ts`
  - builds `todos.component` on the server after `PUT` and `PATCH`
- `src/lib/server-components.tsx`
  - defines `TodoServerComponent`
  - expects client slots for toggle and delete actions
- `src/components/workspace.tsx`
  - renders synced `todo.component` values through `<CompositeComponent />`

## Project Layout

```text
.
├── src/                # TanStack Start routes, server functions, UI, and RSC experiment
├── postgres/init/      # Postgres schema + seed data
├── powersync/          # PowerSync self-hosted config
└── docker-compose.yml  # Local Postgres + PowerSync stack
```

## Production Notes

- The template uses a development HS256 key so it stays copy-paste runnable. Replace it with your real auth flow before shipping.
- The upload endpoint uses a strict table allowlist, but it still assumes a trusted local client. Add real authentication and authorization in production.
- Keep your Postgres schema, `powersync/sync-config.yaml`, and the client schema in `src/lib/powersync/schema.ts` aligned.
