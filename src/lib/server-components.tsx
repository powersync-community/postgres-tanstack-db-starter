// add better types
export function TodoServerComponent({ todo }: any) {
  return (
    <article
      key={todo.id}
      className={`todo-card ${todo.completed === 1 ? "is-complete" : ""}`}
    >
      <label className="todo-toggle">
        {/*replace with a client slot that comes in through props*/}
        {/*<input
        type="checkbox"
        checked={todo.completed === 1}
        onChange={() => handleToggleTodo(todo.id)}
      />*/}
        <span>{todo.description}</span>
      </label>
      <div className="todo-meta">
        <small>
          {todo.completed_at
            ? `Completed ${formatTimestamp(todo.completed_at)}`
            : `Created ${formatTimestamp(todo.created_at)}`}
        </small>
        {/*replace with a client slot that comes in through props*/}
        {/*<button
        type="button"
        className="ghost-button"
        onClick={() => handleDeleteTodo(todo.id)}
      >
        Delete
      </button>*/}
      </div>
    </article>
  );
}

function formatTimestamp(value: string | Date | null | undefined): string {
  if (!value) {
    return "Not yet";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  // imagine using a heavy third party dependency here
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
