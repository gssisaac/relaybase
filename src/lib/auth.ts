import type { Context } from "hono";
import type { Env } from "../env";
import { resolveKey } from "./keys";

const ADMIN_KV_KEY = "config:admin";

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function resolveAdminToken(env: Env): Promise<string | null> {
  const raw = await env.KEYS.get(ADMIN_KV_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as { token?: string };
    if (parsed.token?.trim()) return parsed.token.trim();
  }
  return env.ADMIN_TOKEN?.trim() || null;
}

export async function setAdminToken(kv: KVNamespace, token: string): Promise<void> {
  await kv.put(ADMIN_KV_KEY, JSON.stringify({ token: token.trim() }));
}

export async function requireAdmin(
  c: Context<{ Bindings: Env }>,
): Promise<Response | null> {
  const token = extractBearerToken(c.req.header("Authorization"));
  const expected = await resolveAdminToken(c.env);
  if (!token || !expected || token !== expected) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}

export async function requireBootstrapAuth(
  c: Context<{ Bindings: Env }>,
): Promise<Response | null> {
  const token = extractBearerToken(c.req.header("Authorization"));
  const allowed = [c.env.ADMIN_TOKEN?.trim(), c.env.CF_API_TOKEN?.trim()].filter(
    Boolean,
  );
  if (!token || !allowed.includes(token)) {
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

  const record = await resolveKey(c.env.KEYS, token);
  if (!record) {
    return c.json({ error: "Invalid or inactive API key" }, 401);
  }

  return { record };
}
