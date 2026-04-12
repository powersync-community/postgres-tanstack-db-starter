import { createCollection } from '@tanstack/react-db'
import { powerSyncCollectionOptions } from '@tanstack/powersync-db-collection'
import { powerSync } from '~/lib/powersync/database'
import { appSchema } from '~/lib/powersync/schema'

export const listsCollection = createCollection(
  powerSyncCollectionOptions({
    database: powerSync,
    table: appSchema.props.lists,
  }),
)

export const todosCollection = createCollection(
  powerSyncCollectionOptions({
    database: powerSync,
    table: appSchema.props.todos,
  }),
)
