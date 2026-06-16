import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import { createKey, listKeys } from "../lib/keys";

const adminKeys = new Hono<{ Bindings: Env }>();

adminKeys.post("/", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  let body: { domain?: string; label?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const domain = body.domain?.trim();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }

  try {
    const { record, apiKey } = await createKey(c.env.KEYS, {
      domain,
      label: body.label,
    });
    return c.json(
      {
        id: record.id,
        apiKey,
        domain: record.domain,
        label: record.label,
        createdAt: record.createdAt,
      },
      201,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create key";
    return c.json({ error: message }, 400);
  }
});

adminKeys.get("/", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  const keys = await listKeys(c.env.KEYS);
  return c.json({ keys });
});

export { adminKeys };
