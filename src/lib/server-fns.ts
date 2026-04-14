import { createServerFn } from "@tanstack/react-start";
import { createCompositeComponent } from "@tanstack/react-start/rsc";
import { SignJWT } from "jose";
import { Pool, type PoolClient } from "pg";
import { createElement, type ReactNode } from "react";
import { z } from "zod";
import { serializeRsc } from "./rsc.server";
import { TodoServerComponent } from "./server-components";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DEFAULT_USER_ID: z.string().min(1),
  PS_JWT_AUDIENCE: z.string().min(1),
  PS_JWT_ISSUER: z.string().min(1),
  PS_JWT_KID: z.string().min(1),
  PS_JWT_SECRET: z.string().min(1),
  VITE_POWERSYNC_URL: z.string().url(),
});

const env = envSchema.parse(process.env);
const pool = new Pool({ connectionString: env.DATABASE_URL });

const tableConfig = {
  lists: {
    columns: new Set(["owner_id", "name", "created_at"]),
    booleanColumns: new Set<string>(),
  },
  todos: {
    columns: new Set([
      "list_id",
      "description",
      "completed",
      "component",
      "created_at",
      "completed_at",
    ]),
    booleanColumns: new Set(["completed"]),
  },
} as const;

type AllowedTable = keyof typeof tableConfig;

type TodoRow = {
  id: string;
  list_id: string;
  description: string;
  completed: boolean;
  component: string | null;
  created_at: string;
  completed_at: string | null;
};

const operationSchema = z.object({
  id: z.string().min(1),
  op: z.enum(["PUT", "PATCH", "DELETE"]),
  table: z.enum(["lists", "todos"]),
  opData: z.record(z.string(), z.unknown()).optional(),
});

export const getPowerSyncCredentials = createServerFn({ method: "GET" })
  .inputValidator((input: { userId?: string } | undefined) => input)
  .handler(async ({ data }) => {
    const userId = data?.userId?.trim() || env.DEFAULT_USER_ID;

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", kid: env.PS_JWT_KID })
      .setSubject(userId)
      .setAudience(env.PS_JWT_AUDIENCE)
      .setIssuer(env.PS_JWT_ISSUER)
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(new TextEncoder().encode(env.PS_JWT_SECRET));

    return {
      endpoint: env.VITE_POWERSYNC_URL,
      token,
      userId,
    };
  });

export const getPostgresSnapshot = createServerFn({ method: "GET" }).handler(
  async () => {
    const [listsResult, todosResult] = await Promise.all([
      pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM lists WHERE owner_id = $1",
        [env.DEFAULT_USER_ID],
      ),
      pool.query<{ todo_count: string; completed_count: string }>(
        `SELECT
          COUNT(*)::text AS todo_count,
          COUNT(*) FILTER (WHERE completed IS TRUE)::text AS completed_count
        FROM todos
        INNER JOIN lists ON lists.id = todos.list_id
        WHERE lists.owner_id = $1`,
        [env.DEFAULT_USER_ID],
      ),
    ]);

    return {
      userId: env.DEFAULT_USER_ID,
      renderedAt: new Date().toISOString(),
      listCount: Number(listsResult.rows[0]?.count ?? 0),
      todoCount: Number(todosResult.rows[0]?.todo_count ?? 0),
      completedCount: Number(todosResult.rows[0]?.completed_count ?? 0),
    };
  },
);

export const uploadPowerSyncData = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { operations: Array<z.infer<typeof operationSchema>> }) => input,
  )
  .handler(async ({ data }) => {
    const parsed = z
      .object({ operations: z.array(operationSchema) })
      .safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten(),
      };
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const operation of parsed.data.operations) {
        const opData = sanitizeData(operation.table, operation.opData);

        switch (operation.op) {
          case "PUT":
            await upsertRecord(client, operation.table, operation.id, opData);
            break;
          case "PATCH":
            await updateRecord(client, operation.table, operation.id, opData);
            break;
          case "DELETE":
            await deleteRecord(client, operation.table, operation.id);
            break;
        }
      }

      await client.query("COMMIT");
      return { success: true };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("PowerSync upload failed", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown upload error",
      };
    } finally {
      client.release();
    }
  });

function sanitizeData(
  table: AllowedTable,
  opData: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!opData) {
    return {};
  }

  const config = tableConfig[table];
  const data: Record<string, unknown> = {};

  for (const [column, value] of Object.entries(opData)) {
    if (!config.columns.has(column)) {
      continue;
    }

    if (table === "todos" && column === "component") {
      continue;
    }

    if (config.booleanColumns.has(column) && typeof value === "number") {
      data[column] = value === 1;
      continue;
    }

    data[column] = value;
  }

  return data;
}

async function upsertRecord(
  client: PoolClient,
  table: AllowedTable,
  id: string,
  opData: Record<string, unknown>,
) {
  const columns = Object.keys(opData);
  if (columns.length === 0) {
    return;
  }

  const quotedColumns = columns.map(quoteIdentifier);
  const values = columns.map((column) => opData[column]);
  const placeholders = columns.map((_, index) => `$${index + 2}`).join(", ");
  const updates = quotedColumns
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  await client.query(
    `INSERT INTO ${quoteIdentifier(table)} (id, ${quotedColumns.join(", ")}) VALUES ($1, ${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`,
    [id, ...values],
  );

  if (table === "todos") {
    await refreshTodoComponent(client, id);
  }
}

async function updateRecord(
  client: PoolClient,
  table: AllowedTable,
  id: string,
  opData: Record<string, unknown>,
) {
  const columns = Object.keys(opData);
  if (columns.length === 0) {
    return;
  }

  const values = columns.map((column) => opData[column]);
  const assignments = columns
    .map((column, index) => `${quoteIdentifier(column)} = $${index + 2}`)
    .join(", ");

  await client.query(
    `UPDATE ${quoteIdentifier(table)} SET ${assignments} WHERE id = $1`,
    [id, ...values],
  );

  if (table === "todos") {
    await refreshTodoComponent(client, id);
  }
}

async function deleteRecord(
  client: PoolClient,
  table: AllowedTable,
  id: string,
) {
  await client.query(`DELETE FROM ${quoteIdentifier(table)} WHERE id = $1`, [
    id,
  ]);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function refreshTodoComponent(client: PoolClient, id: string) {
  const todo = await getTodoById(client, id);
  if (!todo) {
    return;
  }

  const component = await createCompositeComponent(
    (props: {
      renderToggle?: (data: { todoId: string; completed: boolean }) => ReactNode;
      renderDelete?: (data: { todoId: string }) => ReactNode;
    }) =>
      createElement(TodoServerComponent, {
        todo,
        renderToggle: props.renderToggle,
        renderDelete: props.renderDelete,
      }),
  );

  await client.query(`UPDATE todos SET component = $2 WHERE id = $1`, [
    id,
    await serializeRsc(component),
  ]);
}

async function getTodoById(
  client: PoolClient,
  id: string,
): Promise<TodoRow | undefined> {
  const result = await client.query<TodoRow>(
    `SELECT id, list_id, description, completed, component, created_at, completed_at
     FROM todos
     WHERE id = $1`,
    [id],
  );

  return result.rows[0];
}
