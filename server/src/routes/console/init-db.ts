import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import {
  MIGRATIONS,
  splitMigrationSql,
  type MigrationTarget,
} from "../../../db/migrations";

const consoleInitDb = new Hono<{ Bindings: Env }>();

const MIGRATIONS_TABLE = "d1_migrations";
const PROBE_TABLES: Record<MigrationTarget, string> = {
  app: "domains",
  logs: "ops_log",
  inbox: "inbound_search_fts",
};

type DbResult = {
  target: MigrationTarget;
  binding: string;
  configured: boolean;
  alreadyInitialized: boolean;
  applied: string[];
  skipped: string[];
  error?: string;
};

async function tableExists(
  db: D1Database,
  tableName: string,
): Promise<boolean> {
  try {
    await db.prepare(`SELECT 1 AS ok FROM ${tableName} LIMIT 1`).first();
    return true;
  } catch {
    return false;
  }
}

async function listAppliedMigrations(
  db: D1Database,
): Promise<string[]> {
  try {
    const rows = await db
      .prepare(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name`)
      .all<{ name: string }>();
    return rows.results?.map((r) => r.name) ?? [];
  } catch {
    return [];
  }
}

async function dropAllTables(db: D1Database): Promise<void> {
  const rows = await db
    .prepare(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    .all<{ name: string; type: string }>();
  const objects = rows.results ?? [];
  for (const obj of objects) {
    const clause = obj.type === "table" ? "TABLE" : obj.type === "index" ? "INDEX" : "TRIGGER";
    await db.prepare(`DROP ${clause} IF EXISTS \`${obj.name}\``).run();
  }
}

async function applyMigrationsForTarget(
  env: Env,
  target: MigrationTarget,
  clear: boolean,
): Promise<DbResult> {
  const bindingMap: Record<MigrationTarget, string> = {
    app: "RELAYBASE_DB",
    logs: "RELAYBASE_LOGS",
    inbox: "RELAYBASE_INBOX_INDEX",
  };
  const binding = bindingMap[target];
  const db = (env as Record<string, unknown>)[binding] as D1Database | undefined;

  if (!db) {
    return {
      target,
      binding,
      configured: false,
      alreadyInitialized: false,
      applied: [],
      skipped: [],
      error: `D1 binding ${binding} is not configured`,
    };
  }

  const probeTable = PROBE_TABLES[target];
  const wasInitialized = await tableExists(db, probeTable);

  if (clear) {
    await dropAllTables(db);
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    )
    .run();

  const appliedNames = await listAppliedMigrations(db);
  const appliedSet = new Set(appliedNames);

  const targetMigrations = MIGRATIONS.filter((m) => m.target === target);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of targetMigrations) {
    if (!clear && appliedSet.has(migration.name)) {
      skipped.push(migration.name);
      continue;
    }
    const statements = splitMigrationSql(migration.sql);
    for (const stmt of statements) {
      await db.prepare(stmt).run();
    }
    await db
      .prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`)
      .bind(migration.name)
      .run();
    applied.push(migration.name);
  }

  return {
    target,
    binding,
    configured: true,
    alreadyInitialized: wasInitialized,
    applied,
    skipped,
  };
}

/**
 * POST /console/init-db
 *
 * Initializes D1 schema by applying embedded migrations. The Worker owns its
 * own schema — the desktop installer never runs SQL directly.
 *
 * Body: { clear?: boolean }
 *   clear=false (default): apply only pending migrations, keep existing data.
 *   clear=true: drop all tables/indexes/triggers first, then re-apply all.
 *
 * Response: {
 *   ok: true,
 *   alreadyInitialized: boolean,  // any target had tables before this call
 *   applied: string[],             // migration names applied in this call
 *   skipped: string[],             // migration names already present (clear=false)
 *   cleared: boolean,
 *   results: DbResult[]           // per-target detail
 * }
 *
 * Requires admin-token auth (ADMIN_TOKEN).
 */
consoleInitDb.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { clear?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    /* clear defaults to false */
  }
  const clear = Boolean(body.clear);

  const targets: MigrationTarget[] = ["app", "logs", "inbox"];
  const results: DbResult[] = [];
  for (const target of targets) {
    results.push(await applyMigrationsForTarget(c.env, target, clear));
  }

  const alreadyInitialized = results.some((r) => r.alreadyInitialized);
  const applied = results.flatMap((r) => r.applied);
  const skipped = results.flatMap((r) => r.skipped);

  return c.json({
    ok: true,
    alreadyInitialized,
    applied,
    skipped,
    cleared: clear,
    results,
  });
});

export { consoleInitDb };
