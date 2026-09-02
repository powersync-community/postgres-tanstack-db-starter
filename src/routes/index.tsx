import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { Workspace } from '~/components/workspace'

export const Route = createFileRoute('/')({
  component: IndexRoute,
})

// Wraps Workspace (and its powersync/wa-sqlite import chain) so the Start compiler
// strips it from the server compile instead of bundling wa-sqlite's wasm server-side.
function IndexRoute() {
  return (
    <ClientOnly fallback={<div>Loading…</div>}>
      <Workspace />
    </ClientOnly>
  )
}
