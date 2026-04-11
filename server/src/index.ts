import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { SignJWT } from "jose";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const envSchema = z.object({
  SERVER_PORT: z.string().min(1),
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
    columns: new Set(["list_id", "description", "completed", "created_at", "completed_at"]),
    booleanColumns: new Set(["completed"]),
  },
} as const;

type AllowedTable = keyof typeof tableConfig;

const operationSchema = z.object({
  id: z.string().min(1),
  op: z.enum(["PUT", "PATCH", "DELETE"]),
  table: z.enum(["lists", "todos"]),
  opData: z.record(z.string(), z.unknown()).optional(),
});

const uploadRequestSchema = z.object({
  operations: z.array(operationSchema),
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown database error",
    });
  }
});

app.get("/api/auth/token", async (request, response, next) => {
  try {
    const requestedUserId = typeof request.query.user_id === "string" ? request.query.user_id : undefined;
    const userId = requestedUserId || env.DEFAULT_USER_ID;

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", kid: env.PS_JWT_KID })
      .setSubject(userId)
      .setAudience(env.PS_JWT_AUDIENCE)
      .setIssuer(env.PS_JWT_ISSUER)
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(new TextEncoder().encode(env.PS_JWT_SECRET));

    response.json({
      token,
      powersyncUrl: env.VITE_POWERSYNC_URL,
      userId,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/powersync/upload", async (request, response) => {
  const parsed = uploadRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.json({
      success: false,
      error: parsed.error.flatten(),
    });
    return;
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
    response.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("PowerSync upload failed", error);
    response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    });
  } finally {
    client.release();
  }
});

app.listen(Number(env.SERVER_PORT), () => {
  console.log(`Backend listening on http://localhost:${env.SERVER_PORT}`);
});

function sanitizeData(table: AllowedTable, opData: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!opData) {
    return {};
  }

  const config = tableConfig[table];
  const data: Record<string, unknown> = {};

  for (const [column, value] of Object.entries(opData)) {
    if (!config.columns.has(column)) {
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
  const updates = quotedColumns.map((column) => `${column} = EXCLUDED.${column}`).join(", ");

  await client.query(
    `INSERT INTO ${quoteIdentifier(table)} (id, ${quotedColumns.join(", ")}) VALUES ($1, ${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`,
    [id, ...values],
  );
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
}

async function deleteRecord(client: PoolClient, table: AllowedTable, id: string) {
  await client.query(`DELETE FROM ${quoteIdentifier(table)} WHERE id = $1`, [id]);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
