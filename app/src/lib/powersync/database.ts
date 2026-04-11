import { PowerSyncDatabase } from "@powersync/web";
import { connector } from "./connector";
import { appSchema } from "./schema";

export const powerSync = new PowerSyncDatabase({
  schema: appSchema,
  database: {
    dbFilename: "starter.db",
  },
});

let started = false;

export function startPowerSync() {
  if (started) {
    return;
  }

  started = true;
  powerSync.connect(connector, {
    crudUploadThrottleMs: 750,
  });
}
