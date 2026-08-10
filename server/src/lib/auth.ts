import type { Context } from "hono";
import type { Env } from "../env";
import { resolveKey } from "./keys";

const ADMIN_KV_KEY = "srv:config:admin";

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function kvAdminToken(env: Env): Promise<string | null> {
  const raw = await env.RELAYBASE_APP.get(ADMIN_KV_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token?.trim() || null;
  } catch {
    return null;
  }
}

/** Prefer wrangler secret; fall back to KV (legacy bootstrap). */
export async function resolveAdminToken(env: Env): Promise<string | null> {
  return env.ADMIN_TOKEN?.trim() || (await kvAdminToken(env));
}

export async function requireAdmin(
  c: Context<{ Bindings: Env }>,
): Promise<Response | null> {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  // Accept either the Wrangler secret OR KV srv:config:admin.
  // Previously KV won exclusively, so a fresh `wrangler secret put ADMIN_TOKEN`
  // was ignored when an old bootstrap token remained in RELAYBASE_APP.
  const secret = c.env.ADMIN_TOKEN?.trim() || null;
  const fromKv = await kvAdminToken(c.env);
  const allowed = [secret, fromKv].filter(Boolean) as string[];
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

  const record = await resolveKey(c.env.RELAYBASE_APP, token);
  if (!record) {
    return c.json({ error: "Invalid or inactive API key" }, 401);
  }

  return { record };
}

