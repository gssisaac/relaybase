import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import {
  clearMobileConfig,
  getMobileConfig,
  rotateMobileConfig,
  toMobileConfigPublicView,
} from "../../lib/mobile-config";

const consoleMobileConfig = new Hono<{ Bindings: Env }>();

/** Whether mobile access is enabled and when it was last set. */
consoleMobileConfig.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const config = await getMobileConfig(c.env.RELAYBASE_APP);
  return c.json(toMobileConfigPublicView(config));
});

/**
 * Set or regenerate the mobile access password. Stores a salted SHA-256 hash
 * in KV and returns the plain password once so the desktop can show / QR it.
 * The plain password is never persisted on the Mac disk.
 */
consoleMobileConfig.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const { password, config } = await rotateMobileConfig(c.env.RELAYBASE_APP);
  return c.json({
    password,
    enabled: true,
    updatedAt: config.updatedAt,
  });
});

/** Disable mobile access entirely (clears the stored hash). */
consoleMobileConfig.delete("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  await clearMobileConfig(c.env.RELAYBASE_APP);
  return c.json({ enabled: false, updatedAt: null });
});

export { consoleMobileConfig };
