import type { Context, Next } from "hono";

const PUBLIC_PATH_PREFIXES = [
  "/health",
  "/crm/t/",
  "/crm/unsubscribe",
  "/crm/assets/",
] as const;

function isAutomationHookPath(path: string): boolean {
  return path.startsWith("/crm/hooks/");
}

function isPublicCrmPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

/** Webhook bounce uses separate shared secret (see webhooks route). */
export function isCrmWebhookPath(path: string): boolean {
  return path.startsWith("/crm/webhooks/");
}

export function crmApiAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const path = c.req.path;
    if (isPublicCrmPath(path)) {
      await next();
      return;
    }

    if (isCrmWebhookPath(path) || isAutomationHookPath(path)) {
      await next();
      return;
    }

    const secret = process.env.CRM_API_SECRET?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        return c.json({ error: "CRM API auth is not configured" }, 503);
      }
      await next();
      return;
    }

    const auth = c.req.header("Authorization")?.trim();
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    const headerKey = c.req.header("X-CRM-API-Key")?.trim();
    if (bearer === secret || headerKey === secret) {
      await next();
      return;
    }

    return c.json({ error: "unauthorized" }, 401);
  };
}
