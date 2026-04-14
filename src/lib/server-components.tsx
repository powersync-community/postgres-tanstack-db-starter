import { type ReactNode } from "react";

type TodoServerRow = {
  id: string;
  description: string;
  completed: boolean | number;
  created_at: string | Date | null;
  completed_at: string | Date | null;
};

export function TodoServerComponent({
  todo,
  renderToggle,
  renderDelete,
}: {
  todo: TodoServerRow;
  renderToggle?: (data: { todoId: string; completed: boolean }) => ReactNode;
  renderDelete?: (data: { todoId: string }) => ReactNode;
}) {
  const isCompleted = todo.completed === true || todo.completed === 1;

  return (
    <article
      key={todo.id}
      className={`todo-card ${isCompleted ? "is-complete" : ""}`}
    >
      <label className="todo-toggle">
        {renderToggle?.({ todoId: todo.id, completed: isCompleted })}
        <span>{todo.description}</span>
      </label>
      <div className="todo-meta">
        <small>
          {todo.completed_at
            ? `Completed ${formatTimestamp(todo.completed_at)}`
            : `Created ${formatTimestamp(todo.created_at)}`}
        </small>
        {renderDelete?.({ todoId: todo.id })}
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
