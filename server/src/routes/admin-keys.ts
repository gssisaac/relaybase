import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import {
  createKey,
  listKeys,
  revokeKey,
  rotateKey,
  setKeyActive,
} from "../lib/keys";

const adminKeys = new Hono<{ Bindings: Env }>();

adminKeys.post("/", async (c) => {
  const denied = await requireAdmin(c);
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
    const { record, apiKey } = await createKey(c.env.RELAYBASE_APP, {
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
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const keys = await listKeys(c.env.RELAYBASE_APP);
  return c.json({ keys });
});

adminKeys.patch("/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const id = c.req.param("id")?.trim();
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  let body: { active?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.active !== "boolean") {
    return c.json({ error: "active boolean is required" }, 400);
  }

  const record = await setKeyActive(c.env.RELAYBASE_APP, id, body.active);
  if (!record) {
    return c.json({ error: "Key not found" }, 404);
  }
  return c.json({ key: record });
});

adminKeys.post("/:id/rotate", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const id = c.req.param("id")?.trim();
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const rotated = await rotateKey(c.env.RELAYBASE_APP, id);
  if (!rotated) {
    return c.json({ error: "Key not found" }, 404);
  }
  return c.json({
    id: rotated.record.id,
    apiKey: rotated.apiKey,
    domain: rotated.record.domain,
    label: rotated.record.label,
    createdAt: rotated.record.createdAt,
  });
});

adminKeys.delete("/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const id = c.req.param("id")?.trim();
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const deleted = await revokeKey(c.env.RELAYBASE_APP, id);
  if (!deleted) {
    return c.json({ error: "Key not found" }, 404);
  }

  return c.json({ ok: true, id });
});

export { adminKeys };
