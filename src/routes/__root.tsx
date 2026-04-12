import { useEffect } from 'react'
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { PowerSyncContext } from '@powersync/react'
import { powerSync, startPowerSync } from '~/lib/powersync/database'
import appCss from '~/styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'PowerSync Postgres + TanStack DB Starter' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  useEffect(() => {
    startPowerSync()
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <PowerSyncContext.Provider value={powerSync}>
          <Outlet />
        </PowerSyncContext.Provider>
        <Scripts />
      </body>
    </html>
  )
}
