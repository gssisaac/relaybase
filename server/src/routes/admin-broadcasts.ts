import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import {
  createBroadcastDraft,
  getBroadcastDetail,
  getBroadcastProgress,
  readBroadcasts,
  sendBroadcast,
  updateBroadcastDraft,
} from "../lib/catalog-broadcasts";

const adminBroadcasts = new Hono<{ Bindings: Env }>();

adminBroadcasts.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const broadcasts = await readBroadcasts(c.env.RELAYBASE_APP);
  const domain = c.req.query("domain")?.trim().toLowerCase();
  const filtered = domain
    ? broadcasts.filter((b) => b.domain === domain)
    : broadcasts;
  return c.json({ broadcasts: filtered });
});

adminBroadcasts.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  let body: {
    id?: string;
    groupIds?: string[];
    from?: string;
    subject?: string;
    body?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const broadcast = await createBroadcastDraft(c.env.RELAYBASE_APP, {
      id: body.id,
      groupIds: body.groupIds ?? [],
      from: body.from,
      subject: body.subject,
      body: body.body,
    });
    return c.json({ broadcast }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

adminBroadcasts.get("/:broadcastId", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const detail = await getBroadcastDetail(
    c.env.RELAYBASE_APP,
    c.req.param("broadcastId"),
  );
  if (!detail) return c.json({ error: "Broadcast not found" }, 404);
  return c.json(detail);
});

adminBroadcasts.patch("/:broadcastId", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  let body: {
    groupIds?: string[];
    from?: string | null;
    subject?: string;
    body?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const broadcast = await updateBroadcastDraft(
      c.env.RELAYBASE_APP,
      c.req.param("broadcastId"),
      body,
    );
    return c.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

adminBroadcasts.post("/:broadcastId/send", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  let body: { from?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // empty body ok
  }
  try {
    const broadcast = await sendBroadcast(
      c.env,
      c.req.param("broadcastId"),
      body,
    );
    return c.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

adminBroadcasts.get("/:broadcastId/progress", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const broadcasts = await readBroadcasts(c.env.RELAYBASE_APP);
  const broadcast = broadcasts.find(
    (b) => b.id === c.req.param("broadcastId"),
  );
  if (!broadcast) return c.json({ error: "Broadcast not found" }, 404);
  return c.json(getBroadcastProgress(broadcast));
});

export { adminBroadcasts };
