import {
  createLicense,
  listLicenses,
  revokeLicense,
  verifyLicense,
} from "@/lib/licenses";
import { getEnv, verifyRequestSession } from "@/lib/env";

export const runtime = "edge";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readJson<T = unknown>(req: Request): Promise<T> {
  return req.json() as Promise<T>;
}

/**
 * Admin gate for /v1/license/admin. Uses the console session cookie (issued
 * by /v1/account/login) OR the legacy ADMIN_TOKEN bearer for the internal
 * admin panel. The internal admin panel authenticates with a shared admin
 * token; customers use the session cookie.
 */
async function isAdmin(req: Request, env: CloudflareEnv): Promise<boolean> {
  // 1) Session cookie (console login)
  try {
    const secret = env.CONSOLE_SESSION_SECRET;
    if (secret) {
      const session = await verifyRequestSession(req, secret);
      if (session) return true;
    }
  } catch {
    // ignore — fall through to bearer
  }
  // 2) Legacy admin bearer (internal admin panel)
  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const adminToken = env.RELAYBASE_ADMIN_TOKEN;
  return Boolean(bearer && adminToken && bearer === adminToken);
}

/** Public: activate / offline-check from the desktop app. */
export async function POST(req: Request) {
  const env = await getEnv();
  const url = new URL(req.url);
  if (url.pathname.endsWith("/verify")) {
    return handleVerify(req, env);
  }
  if (url.pathname.endsWith("/admin")) {
    if (!(await isAdmin(req, env))) return json({ error: "Unauthorized" }, 401);
    return handleAdminCreate(req, env);
  }
  return json({ error: "Not found" }, 404);
}

export async function GET(req: Request) {
  const env = await getEnv();
  const url = new URL(req.url);
  if (url.pathname.endsWith("/admin")) {
    if (!(await isAdmin(req, env))) return json({ error: "Unauthorized" }, 401);
    const licenses = await listLicenses(env.RELAYBASE_LICENSES!);
    return json({ licenses });
  }
  return json({ error: "Not found" }, 404);
}

export async function DELETE(req: Request) {
  const env = await getEnv();
  const url = new URL(req.url);
  if (url.pathname.startsWith("/v1/license/admin/")) {
    if (!(await isAdmin(req, env))) return json({ error: "Unauthorized" }, 401);
    const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    if (!id) return json({ error: "id required" }, 400);
    const ok = await revokeLicense(env.RELAYBASE_LICENSES!, id);
    if (!ok) return json({ error: "Not found" }, 404);
    return json({ revoked: true });
  }
  return json({ error: "Not found" }, 404);
}

async function handleVerify(req: Request, env: CloudflareEnv): Promise<Response> {
  let body: { licenseKey?: string };
  try {
    body = await readJson(req);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const key = body.licenseKey?.trim();
  if (!key) return json({ ok: false, error: "licenseKey required" }, 400);
  const record = await verifyLicense(env.RELAYBASE_LICENSES!, key);
  if (!record) return json({ ok: false, error: "Invalid or revoked license" }, 404);
  return json({
    ok: true,
    email: record.email,
    createdAt: record.createdAt,
    tier: record.tier,
    status: record.status,
    currentPeriodEnd: record.currentPeriodEnd,
  });
}

async function handleAdminCreate(
  req: Request,
  env: CloudflareEnv,
): Promise<Response> {
  let body: { email?: string; note?: string; tier?: "free" | "pro" };
  try {
    body = await readJson(req);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.email?.trim()) return json({ error: "email required" }, 400);
  const { record, licenseKey } = await createLicense(env.RELAYBASE_LICENSES!, {
    email: body.email,
    tier: body.tier ?? "pro",
    note: body.note ?? "manual",
  });
  return json({ record, licenseKey });
}

// Silence unused-import warnings for helpers reserved for future admin scopes.
