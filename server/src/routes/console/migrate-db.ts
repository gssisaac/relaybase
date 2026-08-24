import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import { applyPendingMigrations } from "../../lib/d1-migrations";

const consoleMigrateDb = new Hono<{ Bindings: Env }>();

/**
 * POST /console/migrate-db
 *
 * Apply pending D1 migrations only. Never drops tables. No `clear` body.
 * Used after Worker updates and when install reuses existing D1s.
 *
 * Requires admin-token auth (ADMIN_TOKEN).
 */
consoleMigrateDb.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const applied = await applyPendingMigrations(c.env);
  if (applied.errors.length > 0) {
    return c.json(
      {
        ok: false,
        alreadyInitialized: applied.alreadyInitialized,
        applied: applied.applied,
        skipped: applied.skipped,
        results: applied.results,
        error: applied.errors.join("; "),
      },
      500,
    );
  }

  return c.json({
    ok: true,
    alreadyInitialized: applied.alreadyInitialized,
    applied: applied.applied,
    skipped: applied.skipped,
    results: applied.results,
  });
});

export { consoleMigrateDb };
