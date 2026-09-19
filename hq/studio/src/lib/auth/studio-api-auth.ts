import type { Context, Next } from "hono";

import { requireJwtSecret } from "./hq-auth-config";
import { verifyAccessToken } from "./jwt";

const PUBLIC_PATH_PREFIXES = [
  "/health",
  "/auth/",
  "/studio/t/",
  "/studio/unsubscribe",
  "/studio/assets/",
] as const;

function isAutomationHookPath(path: string): boolean {
  return path.startsWith("/studio/hooks/");
}

function isPublicStudioPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

/** Webhook bounce uses separate shared secret (see webhooks route). */
export function isStudioWebhookPath(path: string): boolean {
  return path.startsWith("/studio/webhooks/");
}

export function studioApiAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const path = c.req.path;
    if (isPublicStudioPath(path)) {
      await next();
      return;
    }

    if (isStudioWebhookPath(path) || isAutomationHookPath(path)) {
      await next();
      return;
    }

    const auth = c.req.header("Authorization")?.trim();
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    const headerKey = c.req.header("X-Studio-API-Key")?.trim();

    if (bearer) {
      try {
        const jwtSecret = requireJwtSecret();
        const claims = verifyAccessToken(bearer, jwtSecret);
        if (claims) {
          c.set("hqUserId", claims.sub);
          c.set("hqAccountLinkId", claims.accountLinkId);
          await next();
          return;
        }
      } catch {
        /* fall through */
      }
    }

    const secret = process.env.STUDIO_API_SECRET?.trim();
    if (secret && (bearer === secret || headerKey === secret)) {
      await next();
      return;
    }

    if (!secret && process.env.NODE_ENV !== "production") {
      await next();
      return;
    }

    return c.json({ error: "unauthorized" }, 401);
  };
}
