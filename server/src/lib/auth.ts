import type { Context } from "hono";
import type { Env } from "../env";
import { createAppDb } from "../../db/app";
import { resolveKey } from "./keys";
import { verifyAccessToken, type OwnerScope } from "./owner-auth";
import { getOwnerLoginConfig } from "../../db/app/owner";

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Validate an owner access token for the given scope (mail vs console).
 * Returns null on success, or a 401 Response on failure.
 */
export async function requireOwnerSession(
  c: Context<{ Bindings: Env }>,
  scope: OwnerScope,
): Promise<Response | null> {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const pepper = c.env.AUTH_PEPPER?.trim() ?? "";
  if (!pepper) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyAccessToken(pepper, token);
  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (payload.scope !== undefined && payload.scope !== scope) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  // Legacy unscoped tokens: allow on console routes only.
  if (payload.scope === undefined && scope !== "console") {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = createAppDb(c.env.RELAYBASE_DB);
  if (db) {
    const cfg = await getOwnerLoginConfig(db);
    if (!cfg?.adminUsername) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  return null;
}

export function requireConsoleSession(
  c: Context<{ Bindings: Env }>,
): Promise<Response | null> {
  return requireOwnerSession(c, "console");
}

export function requireMailSession(
  c: Context<{ Bindings: Env }>,
): Promise<Response | null> {
  return requireOwnerSession(c, "mail");
}

/**
 * Bootstrap auth for install-time endpoints (init-db, migrate-db, setup-admin).
 * Allowed only when no owner is configured yet AND the body/secret proves
 * knowledge of AUTH_PEPPER. Once an owner exists, these endpoints require a
 * normal owner session.
 */
export async function requirePepperBootstrap(
  c: Context<{ Bindings: Env }>,
): Promise<Response | null> {
  const pepper = c.env.AUTH_PEPPER?.trim() ?? "";
  if (!pepper) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const provided = c.req.header("X-Auth-Pepper")?.trim() ?? "";
  if (!provided || provided !== pepper) {
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
