import { useClientPowerSync } from '~/lib/powersync/database'

export function Workspace() {
  // NOTE: removing useClientPowerSync and the import causes the WASM files to be excluded from the server build. 
  useClientPowerSync()

  return (
    <div>Testing</div>
  )
}
