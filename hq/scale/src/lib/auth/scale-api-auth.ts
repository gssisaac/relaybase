import type { Context, Next } from "hono";

const PUBLIC_PATH_PREFIXES = [
  "/health",
  "/scale/t/",
  "/scale/unsubscribe",
  "/scale/assets/",
] as const;

function isAutomationHookPath(path: string): boolean {
  return path.startsWith("/scale/hooks/");
}

function isPublicScalePath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

/** Webhook bounce uses separate shared secret (see webhooks route). */
export function isScaleWebhookPath(path: string): boolean {
  return path.startsWith("/scale/webhooks/");
}

export function scaleApiAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const path = c.req.path;
    if (isPublicScalePath(path)) {
      await next();
      return;
    }

    if (isScaleWebhookPath(path) || isAutomationHookPath(path)) {
      await next();
      return;
    }

    const secret =
      process.env.SCALE_API_SECRET?.trim() ?? process.env.CRM_API_SECRET?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        return c.json({ error: "Scale API auth is not configured" }, 503);
      }
      await next();
      return;
    }

    const auth = c.req.header("Authorization")?.trim();
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    const headerKey = c.req.header("X-Scale-API-Key")?.trim();
    if (bearer === secret || headerKey === secret) {
      await next();
      return;
    }

    return c.json({ error: "unauthorized" }, 401);
  };
}
