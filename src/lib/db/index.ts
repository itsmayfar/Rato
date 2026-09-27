import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL.");

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __mayfarSql?: ReturnType<typeof postgres> };
const client = globalForDb.__mayfarSql ?? postgres(url, { max: 10, onnotice: () => {} });
if (process.env.NODE_ENV !== "production") globalForDb.__mayfarSql = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
