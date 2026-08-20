import type { Context } from "hono";
import type { Env } from "../env";
import { createAppDb } from "../../db/app";
import { getOwnerConfig } from "../../db/app/owner";
import { resolveKey } from "./keys";

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function d1AdminToken(env: Env): Promise<string | null> {
  const config = await getOwnerConfig(createAppDb(env.RELAYBASE_DB));
  return config.adminToken;
}

/** Prefer wrangler secret; then D1 recovery override from `/console/recover-admin`. */
export async function resolveAdminToken(env: Env): Promise<string | null> {
  return env.ADMIN_TOKEN?.trim() || (await d1AdminToken(env)) || null;
}

export async function requireAdmin(
  c: Context<{ Bindings: Env }>,
): Promise<Response | null> {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const secret = c.env.ADMIN_TOKEN?.trim() || null;
  const fromD1 = await d1AdminToken(c.env);
  const allowed = [secret, fromD1].filter(Boolean) as string[];
  if (allowed.length === 0 || !allowed.includes(token)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}

export async function requireApiKey(
  c: Context<{ Bindings: Env }>,
): Promise<{ record: import("./keys").KeyRecord } | Response> {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const record = await resolveKey(createAppDb(c.env.RELAYBASE_DB), token);
  if (!record) {
    return c.json({ error: "Invalid or inactive API key" }, 401);
  }

  return { record };
}
