import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  CompositeComponent,
  createCompositeComponent,
  renderServerComponent,
} from "@tanstack/react-start/rsc";
import { type ReactNode, useEffect, useState } from "react";
import { WorkspaceApp } from "~/components/workspace-app";
import { getPostgresSnapshot } from "~/lib/server-fns";

type PostgresSnapshot = Awaited<ReturnType<typeof getPostgresSnapshot>>;

function ServerIntro({ renderedAt }: { renderedAt: string }) {
  return (
    <section className="rsc-hero">
      <p className="eyebrow">React Server Components POC</p>
      <h1>Server-render a tiny Postgres snapshot, keep the workspace local.</h1>
      <p className="lede">
        This top section now renders on the server from the canonical Postgres
        database, while the board below still runs from the client-side
        PowerSync replica.
      </p>
      <p className="rsc-meta">
        Rendered on the server at {formatTime(renderedAt)}
      </p>
    </section>
  );
}

function ServerSnapshotCard({
  snapshot,
  children,
  renderBadge,
}: {
  snapshot: PostgresSnapshot;
  children?: ReactNode;
  renderBadge?: (data: { renderedAt: string }) => ReactNode;
}) {
  const openCount = snapshot.todoCount - snapshot.completedCount;

  return (
    <section className="rsc-card">
      <div className="rsc-card-header">
        <div>
          <p className="eyebrow">Server snapshot</p>
          <h2>Primary Postgres totals for `{snapshot.userId}`</h2>
        </div>
        {renderBadge?.({ renderedAt: snapshot.renderedAt })}
      </div>

      <div className="rsc-stats-grid">
        <article className="stat-card">
          <strong>{snapshot.listCount}</strong>
          <span>lists in Postgres</span>
        </article>
        <article className="stat-card">
          <strong>{snapshot.todoCount}</strong>
          <span>todos in Postgres</span>
        </article>
        <article className="stat-card">
          <strong>{openCount}</strong>
          <span>open on the server</span>
        </article>
      </div>

      <p className="muted-copy rsc-copy">
        It is intentionally small: one server-rendered summary block above the
        existing PowerSync workspace so it is easy to compare the server view
        and the local replica view.
      </p>

      <div className="rsc-actions">{children}</div>
    </section>
  );
}

const getLanding = createServerFn({ method: "GET" }).handler(async () => {
  const snapshot = await getPostgresSnapshot();

  const intro = await renderServerComponent(
    <ServerIntro renderedAt={snapshot.renderedAt} />,
  );
  console.log("[RSC server] intro", intro);

  const snapshotCard = await createCompositeComponent(
    (props: {
      children?: ReactNode;
      renderBadge?: (data: { renderedAt: string }) => ReactNode;
    }) => (
      <ServerSnapshotCard snapshot={snapshot} renderBadge={props.renderBadge}>
        {props.children}
      </ServerSnapshotCard>
    ),
  );
  console.log("[RSC server] snapshotCard", JSON.stringify(snapshotCard));

  return {
    intro,
    snapshotCard,
  };
});

export const Route = createFileRoute("/")({
  loader: async () => await getLanding(),
  component: HomePage,
});

function HomePage() {
  const { intro, snapshotCard } = Route.useLoaderData();

  useEffect(() => {
    console.log("[RSC client] intro", intro);
    console.log("[RSC client] snapshotCard", snapshotCard);
  }, [intro, snapshotCard]);

  return (
    <main className="page-shell">
      {intro}

      <CompositeComponent
        src={snapshotCard}
        renderBadge={({ renderedAt }) => (
          <span className="status-pill is-live">
            Postgres at {formatTime(renderedAt)}
          </span>
        )}
      >
        <RefreshHint />
      </CompositeComponent>

      <ClientOnly fallback={<WorkspaceFallback />}>
        <WorkspaceApp />
      </ClientOnly>
    </main>
  );
}

function RefreshHint() {
  const [clicks, setClicks] = useState(0);

  return (
    <button
      type="button"
      className="ghost-button"
      onClick={() => setClicks((count) => count + 1)}
    >
      Client island clicks: {clicks}
    </button>
  );
}

function WorkspaceFallback() {
  return (
    <section className="workspace-fallback">
      <p className="eyebrow">Client workspace</p>
      <h2>Hydrating the local PowerSync replica...</h2>
      <p className="muted-copy">
        The board stays client-side because it depends on browser storage,
        offline sync, and live TanStack DB collections.
      </p>
    </section>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
