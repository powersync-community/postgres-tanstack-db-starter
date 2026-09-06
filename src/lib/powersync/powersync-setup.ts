import { PowerSyncDatabase } from "@powersync/web";
import { appSchema } from "./schema";

export function initPowerSync(): PowerSyncDatabase {
  const powerSync = new PowerSyncDatabase({
    schema: appSchema,
    database: {
      dbFilename: "starter.db",
    },
  });

  return powerSync;
}
