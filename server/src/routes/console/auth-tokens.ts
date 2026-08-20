import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import { createAppDb } from "../../../db/app";
import {
  createAuthToken,
  findAuthToken,
  listAuthTokens,
  revokeAuthToken,
} from "../../lib/auth-tokens";

const consoleAuthTokens = new Hono<{ Bindings: Env }>();

consoleAuthTokens.post("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { label?: string; productId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const { record, token } = await createAuthToken(createAppDb(c.env.RELAYBASE_DB), {
      label: body.label,
      productId: body.productId,
    });
    return c.json(
      {
        id: record.id,
        token,
        label: record.label,
        productId: record.productId,
        tokenPrefix: record.tokenPrefix,
        createdAt: record.createdAt,
        message: "Auth token issued — copy it now; it will not be shown again.",
      },
      201,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create auth token";
    return c.json({ error: message }, 400);
  }
});

consoleAuthTokens.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const tokens = await listAuthTokens(createAppDb(c.env.RELAYBASE_DB));
  return c.json({ tokens });
});

consoleAuthTokens.post("/verify", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { token?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const token = body.token?.trim();
  if (!token) return c.json({ error: "token is required" }, 400);

  const record = await findAuthToken(createAppDb(c.env.RELAYBASE_DB), token);
  if (!record) return c.json({ valid: false }, 200);
  return c.json({
    valid: true,
    token: {
      id: record.id,
      label: record.label,
      productId: record.productId,
      tokenPrefix: record.tokenPrefix,
      createdAt: record.createdAt,
    },
  });
});

consoleAuthTokens.delete("/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const revoked = await revokeAuthToken(createAppDb(c.env.RELAYBASE_DB), id);
  if (!revoked) return c.json({ error: "Auth token not found" }, 404);
  return c.json({ ok: true });
});

export { consoleAuthTokens };
