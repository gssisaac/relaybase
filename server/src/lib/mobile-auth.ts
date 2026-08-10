import type { Env } from "../env";
import { extractBearerToken } from "./auth";
import {
  constantTimeEqual,
  getMobileConfig,
  hashMobilePassword,
  type StoredMobileConfig,
} from "./mobile-config";

/**
 * Minimal slice of a Hono context that `requireMobilePassword` needs.
 * Declared structurally so the middleware can be called from any Hono app
 * regardless of its `Variables` type (avoids `set`/`get` variance issues).
 */
type MobileAuthContext = {
  req: {
    header(name: string): string | undefined;
  };
  env: Env;
  json(body: unknown, status: number): Response;
};

/**
 * Authenticate `/mobile/*` requests with the mobile access password.
 *
 * The desktop app writes a salted SHA-256 hash of the password to
 * `srv:config:mobile`. The Flutter app sends the plain password as
 * `Authorization: Bearer {password}`; we re-hash with the stored salt and
 * compare in constant time. Returns the resolved config on success so
 * routes can read metadata if needed.
 */
export async function requireMobilePassword(
  c: MobileAuthContext,
): Promise<{ config: StoredMobileConfig } | Response> {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const config = await getMobileConfig(c.env.RELAYBASE_APP);
  if (!config) {
    // Mobile access has not been configured by the desktop app.
    return c.json({ error: "Mobile access is not configured" }, 401);
  }

  const candidateHash = await hashMobilePassword(token, config.salt);
  if (!constantTimeEqual(candidateHash, config.passwordHash)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return { config };
}
