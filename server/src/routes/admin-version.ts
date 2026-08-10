import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import { WORKER_VERSION } from "../version";

const adminVersion = new Hono<{ Bindings: Env }>();

/**
 * Reports the deployed Worker version and which D1 migrations the desktop app
 * has recorded as applied. Used by the Tauri app to decide whether a redeploy
 * + migration run is needed after an app update.
 *
 * Auth: same admin Bearer as /admin/connect.
 */
adminVersion.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let migrationsApplied: string[] = [];
  try {
    const raw = await c.env.RELAYBASE_APP.get("srv:meta:migrations");
    if (raw) {
      const parsed = JSON.parse(raw) as { applied?: string[] };
      if (Array.isArray(parsed.applied)) {
        migrationsApplied = parsed.applied.filter(
          (m): m is string => typeof m === "string",
        );
      }
    }
  } catch (error) {
    console.error("Failed to read srv:meta:migrations", error);
  }

  return c.json({
    ok: true,
    product: "relaybase",
    workerVersion: WORKER_VERSION,
    workerScriptName: c.env.WORKER_SCRIPT_NAME || "relaybase-api",
    migrationsApplied,
  });
});

export { adminVersion };
