// even excluding the type and just using 'any' doesn't make a difference.
// import type { PowerSyncDatabase } from "@powersync/web";
import { useEffect, useState } from "react";

let dbInstance: any | null = null;

export function useClientPowerSync() {
  const [db, setDb] = useState<any | null>(dbInstance);

  useEffect(() => {
    if (dbInstance) return;
    let isMounted = true;

    // Dynamic import ensures Vite excludes wa-sqlite and wasm from the SSR bundle
    import("./powersync-setup").then(async ({ initPowerSync }) => {
      const instance = await initPowerSync();
      dbInstance = instance;
      if (isMounted) {
        setDb(instance);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return db;
}
