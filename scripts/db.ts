import "dotenv/config";
import { Pool, type PoolConfig } from "pg";

export function loadEnvFiles(): void {
  // .env.local takes precedence over .env (matches Next.js behavior).
  // dotenv/config already loaded .env; reload .env.local on top if present.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local", override: true });
}

export function makePool(): Pool {
  loadEnvFiles();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL is not set. Add it to .env.local.");
    process.exit(1);
  }
  const needsSsl =
    /sslmode=require/i.test(connectionString) ||
    /\.railway\.app/i.test(connectionString) ||
    /\.rlwy\.net/i.test(connectionString);
  const config: PoolConfig = {
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  };
  return new Pool(config);
}
