/**
 * Create the `relaybase` database on the Postgres instance (idempotent).
 *
 * Connect with an admin URL pointing at an existing DB (usually `railway`):
 *   DATABASE_PUBLIC_URL=postgresql://postgres:...@host:PORT/railway  (local / external)
 *   DATABASE_ADMIN_URL=postgresql://postgres:...@postgres.railway.internal:5432/railway  (on Railway)
 */
import "reflect-metadata";

import pg from "pg";

import { postgresClientConfigFromUrl } from "./postgres-client-config";

const TARGET_DB = "relaybase";

function adminDatabaseUrl(): string {
  const url =
    process.env.DATABASE_PUBLIC_URL?.trim() ||
    process.env.DATABASE_ADMIN_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Set DATABASE_PUBLIC_URL (local) or DATABASE_ADMIN_URL (Railway private) before running orm:ensure-db",
    );
  }
  return url;
}

function withDatabaseName(connectionUrl: string, databaseName: string): string {
  const parsed = new URL(connectionUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

async function main() {
  const adminUrl = adminDatabaseUrl();
  const client = new pg.Client(postgresClientConfigFromUrl(adminUrl));
  await client.connect();

  try {
    const exists = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [TARGET_DB]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE ${TARGET_DB}`);
      console.log(`[orm:ensure-db] Created database "${TARGET_DB}".`);
    } else {
      console.log(`[orm:ensure-db] Database "${TARGET_DB}" already exists.`);
    }
  } finally {
    await client.end();
  }

  const appUrl = withDatabaseName(adminUrl, TARGET_DB);
  console.log(`[orm:ensure-db] Use DATABASE_URL=${appUrl}`);
}

main().catch((err) => {
  console.error("[orm:ensure-db] Failed:", err);
  process.exit(1);
});
