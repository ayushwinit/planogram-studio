import "server-only";
import { Pool, type PoolConfig } from "pg";

declare global {
  // Reuse pool across HMR reloads in dev to avoid leaking connections.
  var __pgPool: Pool | undefined;
}

function buildPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  }
  const needsSsl =
    /sslmode=require/i.test(connectionString) ||
    /\.railway\.app/i.test(connectionString) ||
    /\.rlwy\.net/i.test(connectionString);
  const config: PoolConfig = {
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  };
  return new Pool(config);
}

export const db = {
  query: ((text: string, params?: unknown[]) => getPool().query(text, params)) as Pool["query"],
};

function getPool(): Pool {
  if (!globalThis.__pgPool) globalThis.__pgPool = buildPool();
  return globalThis.__pgPool;
}
