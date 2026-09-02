import { useEffect, useState, type FormEvent } from 'react'
import { useStatus } from '@powersync/react'
import { useLiveQuery } from '@tanstack/react-db'
import { listsCollection, todosCollection } from '~/lib/collections'
import { startPowerSync } from '~/lib/powersync/database'
import { PowerSyncContext } from '@powersync/react'
import { powerSync } from '~/lib/powersync/database'

const DEMO_USER_ID = import.meta.env.VITE_USER_ID

// Boots the PowerSync connection; must live inside <ClientOnly> so the wa-sqlite/wasm
// import chain is stripped from the server compile instead of bloating the Worker bundle.
function PowerSyncBoot() {
  useEffect(() => {
    startPowerSync()
  }, [])

  return null
}

// PowerSyncContext.Provider must wrap this component from the outside — a Provider
// only affects descendants, not hooks called earlier in the same component's render.
export function Workspace() {
  return (
    <PowerSyncContext.Provider value={powerSync}>
      <PowerSyncBoot />
      <WorkspaceContent />
    </PowerSyncContext.Provider>
  )
}

function WorkspaceContent() {
  const status = useStatus()
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [newListName, setNewListName] = useState('')
  const [newTodoDescription, setNewTodoDescription] = useState('')

  const { data: lists = [], isLoading: listsLoading } = useLiveQuery((query) =>
    query.from({ list: listsCollection }).orderBy(({ list }) => list.created_at, 'asc'),
  )

  const { data: allTodos = [], isLoading: todosLoading } = useLiveQuery((query) =>
    query.from({ todo: todosCollection }).orderBy(({ todo }) => todo.created_at, 'asc'),
  )

  useEffect(() => {
    if (!lists.length) {
      if (selectedListId !== null) {
        setSelectedListId(null)
      }
      return
    }

    const firstList = lists[0]
    if (firstList && (!selectedListId || !lists.some((list) => list.id === selectedListId))) {
      setSelectedListId(firstList.id)
    }
  }, [lists, selectedListId])

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null
  const todos = selectedListId ? allTodos.filter((todo) => todo.list_id === selectedListId) : []
  const completedCount = todos.filter((todo) => todo.completed === 1).length
  const syncProgress = status.downloadProgress
    ? Math.round(status.downloadProgress.downloadedFraction * 100)
    : null
  const isSyncing = Boolean(status.dataFlowStatus?.uploading || status.dataFlowStatus?.downloading)

  async function handleCreateList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newListName.trim()
    if (!name) {
      return
    }

    const id = crypto.randomUUID()
    await listsCollection.insert({
      id,
      owner_id: DEMO_USER_ID,
      name,
      created_at: new Date().toISOString(),
    }).isPersisted.promise

    setSelectedListId(id)
    setNewListName('')
  }

  async function handleCreateTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const description = newTodoDescription.trim()
    if (!description || !selectedListId) {
      return
    }

    await todosCollection.insert({
      id: crypto.randomUUID(),
      list_id: selectedListId,
      description,
      completed: 0,
      created_at: new Date().toISOString(),
      completed_at: null,
    }).isPersisted.promise

    setNewTodoDescription('')
  }

  async function handleToggleTodo(todoId: string) {
    await todosCollection.update(todoId, (todo) => {
      const nextCompleted = todo.completed === 1 ? 0 : 1
      todo.completed = nextCompleted
      todo.completed_at = nextCompleted === 1 ? new Date().toISOString() : null
    }).isPersisted.promise
  }

  async function handleDeleteTodo(todoId: string) {
    await todosCollection.delete(todoId).isPersisted.promise
  }

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
          <div className="sidebar-header">
            <p className="eyebrow">Starter template</p>
            <h1>PowerSync local workspace</h1>
            <p className="lede">
              Self-hosted Postgres for replication, PowerSync for offline sync, and TanStack DB for fast reactive collections.
            </p>
          </div>

          <div className="status-card">
            <div className="status-row">
              <span className="status-label">State</span>
              <span className={`status-pill ${status.connected ? 'is-live' : 'is-waiting'}`}>
                {status.connecting ? 'Connecting' : isSyncing ? 'Syncing' : status.connected ? 'Live' : status.hasSynced ? 'Offline' : 'Booting'}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">User</span>
              <code>{DEMO_USER_ID}</code>
            </div>
            <div className="status-row">
              <span className="status-label">Last sync</span>
              <span>{formatTimestamp(status.lastSyncedAt)}</span>
            </div>
            {syncProgress !== null ? (
              <div className="progress-block">
                <div className="progress-meta">
                  <span>Download progress</span>
                  <span>{syncProgress}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${syncProgress}%` }} />
                </div>
              </div>
            ) : null}
          </div>

          <form className="stack-form" onSubmit={handleCreateList}>
            <label htmlFor="list-name">Create a list</label>
            <div className="inline-form">
              <input
                id="list-name"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="Sprint notes"
              />
              <button type="submit">Add</button>
            </div>
          </form>

          <div className="list-block">
            <div className="section-heading">
              <h2>Lists</h2>
              <span>{lists.length}</span>
            </div>
            <div className="list-column">
              {listsLoading ? <p className="muted-copy">Loading local replica...</p> : null}
              {!listsLoading && lists.length === 0 ? (
                <p className="muted-copy">No lists yet. Create one and it will sync through Postgres.</p>
              ) : null}
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  className={`list-card ${selectedListId === list.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedListId(list.id)}
                >
                  <span>{list.name}</span>
                  <small>{formatTimestamp(list.created_at)}</small>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="board">
          <div className="board-header">
            <div>
              <p className="eyebrow">Active list</p>
              <h2>{selectedList?.name ?? 'Create your first list'}</h2>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <strong>{todos.length}</strong>
                <span>items</span>
              </div>
              <div className="stat-card">
                <strong>{completedCount}</strong>
                <span>done</span>
              </div>
              <div className="stat-card">
                <strong>{todos.length - completedCount}</strong>
                <span>open</span>
              </div>
            </div>
          </div>

          {status.dataFlowStatus?.downloadError ? (
            <div className="banner is-error">Download error: {status.dataFlowStatus.downloadError.message}</div>
          ) : null}
          {status.dataFlowStatus?.uploadError ? (
            <div className="banner is-error">Upload error: {status.dataFlowStatus.uploadError.message}</div>
          ) : null}

          <form className="composer" onSubmit={handleCreateTodo}>
            <label htmlFor="todo-description">Add a todo</label>
            <div className="inline-form">
              <input
                id="todo-description"
                value={newTodoDescription}
                onChange={(event) => setNewTodoDescription(event.target.value)}
                placeholder={selectedList ? 'Write locally, sync automatically' : 'Create a list first'}
                disabled={!selectedList}
              />
              <button type="submit" disabled={!selectedList}>
                Queue write
              </button>
            </div>
          </form>

          <section className="todo-panel">
            <div className="section-heading">
              <h2>Todos</h2>
              <span>{todos.length}</span>
            </div>

            {todosLoading ? <p className="muted-copy">Waiting for local data...</p> : null}

            {!todosLoading && selectedList && todos.length === 0 ? (
              <p className="muted-copy">This list is empty. Add a todo to see optimistic local writes and sync in action.</p>
            ) : null}

            {!selectedList ? <p className="muted-copy">Select a list on the left or create a new one.</p> : null}

            <div className="todo-list">
              {todos.map((todo) => (
                <article key={todo.id} className={`todo-card ${todo.completed === 1 ? 'is-complete' : ''}`}>
                  <label className="todo-toggle">
                    <input
                      type="checkbox"
                      checked={todo.completed === 1}
                      onChange={() => handleToggleTodo(todo.id)}
                    />
                    <span>{todo.description}</span>
                  </label>
                  <div className="todo-meta">
                    <small>{todo.completed_at ? `Completed ${formatTimestamp(todo.completed_at)}` : `Created ${formatTimestamp(todo.created_at)}`}</small>
                    <button type="button" className="ghost-button" onClick={() => handleDeleteTodo(todo.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
  )
}

function formatTimestamp(value: string | Date | null | undefined): string {
  if (!value) {
    return 'Not yet'
  }

  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}
