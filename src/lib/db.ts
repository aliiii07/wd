// One shared database connection for the whole app.
// Import it anywhere on the server with: import { db } from "@/lib/db";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

// In development Next.js reloads files often; reuse the client instead of
// opening a new connection on every reload.
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createClient> };

export const db = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
