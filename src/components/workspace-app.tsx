'use client'

import { useEffect } from "react";
import { PowerSyncContext } from "@powersync/react";
import { Workspace } from "~/components/workspace";
import { powerSync, startPowerSync } from "~/lib/powersync/database";

export function WorkspaceApp() {
  useEffect(() => {
    startPowerSync();
  }, []);

  return (
    <PowerSyncContext.Provider value={powerSync}>
      <Workspace />
    </PowerSyncContext.Provider>
  );
}
