import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/web";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const POWERSYNC_URL = import.meta.env.VITE_POWERSYNC_URL;
const USER_ID = import.meta.env.VITE_USER_ID;

type TokenResponse = {
  token: string;
  powersyncUrl?: string;
};

export class StarterConnector implements PowerSyncBackendConnector {
  private token: string | null = null;

  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const response = await fetch(`${BACKEND_URL}/api/auth/token?user_id=${encodeURIComponent(USER_ID)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch PowerSync token: ${response.status}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.token = data.token;

    return {
      endpoint: data.powersyncUrl ?? POWERSYNC_URL,
      token: data.token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    const operations = transaction.crud.map((operation) => ({
      id: operation.id,
      op: operation.op,
      table: operation.table,
      opData: operation.opData,
    }));

    try {
      const response = await fetch(`${BACKEND_URL}/api/powersync/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({ operations }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        error?: unknown;
      };

      if (!result.success) {
        console.warn("Upload completed with backend validation feedback", result.error);
      }

      await transaction.complete();
    } catch (error) {
      throw error;
    }
  }
}

export const connector = new StarterConnector();
