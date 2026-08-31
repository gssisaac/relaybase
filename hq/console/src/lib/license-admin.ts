import { verifyRequestSession } from "@/lib/env";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Admin gate for /v1/license/admin. Uses the console session cookie (issued
 * by /v1/account/login) OR `RELAYBASE_ADMIN_TOKEN` bearer for the internal
 * HQ license admin. That token is console license admin only — not a
 * customer Worker passtoken. Customers use the session cookie.
 */
export async function isLicenseAdmin(
  req: Request,
  env: CloudflareEnv,
): Promise<boolean> {
  try {
    const secret = env.CONSOLE_SESSION_SECRET;
    if (secret) {
      const session = await verifyRequestSession(req, secret);
      if (session) return true;
    }
  } catch {
    // ignore — fall through to bearer
  }
  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const adminToken = env.RELAYBASE_ADMIN_TOKEN;
  return Boolean(bearer && adminToken && bearer === adminToken);
}
