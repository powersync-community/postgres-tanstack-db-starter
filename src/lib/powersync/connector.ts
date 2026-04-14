import '@tanstack/react-start/client-only'
import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/web'
import { getPowerSyncCredentials, uploadPowerSyncData } from '~/lib/server-fns'

const USER_ID = import.meta.env.VITE_USER_ID
const ALLOWED_TABLES = new Set(['lists', 'todos'] as const)
const ALLOWED_OPS = new Set(['PUT', 'PATCH', 'DELETE'] as const)

export class StarterConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    return getPowerSyncCredentials({ data: { userId: USER_ID } })
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) {
      return
    }

    const operations = transaction.crud.flatMap((operation) => {
      if (!ALLOWED_TABLES.has(operation.table as 'lists' | 'todos')) {
        console.warn('Skipping upload for unexpected table', operation.table)
        return []
      }

      if (!ALLOWED_OPS.has(operation.op as 'PUT' | 'PATCH' | 'DELETE')) {
        console.warn('Skipping upload for unexpected operation', operation.op)
        return []
      }

      return [{
        id: operation.id,
        op: operation.op as 'PUT' | 'PATCH' | 'DELETE',
        table: operation.table as 'lists' | 'todos',
        opData: operation.opData as Record<string, unknown> | undefined,
      }]
    })

    if (operations.length === 0) {
      await transaction.complete()
      return
    }

    const result = await uploadPowerSyncData({ data: { operations } })
    if (!result.success) {
      console.warn('Upload completed with backend validation feedback', result.error)
    }

    await transaction.complete()
  }
}

export const connector = new StarterConnector()
