import { sessionCookieName, verifySession } from "./accounts";

/**
 * Returns the Cloudflare bindings (D1/KV/secrets) for the current request.
 * In OpenNext on Cloudflare, `getRequestContext()` from @opennextjs/cloudflare
 * exposes the env. During `next dev`, bindings come from
 * `initOpenNextCloudflareForDev()` via the same call.
 */
export async function getEnv(): Promise<CloudflareEnv> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getRequestContext } = require("@opennextjs/cloudflare");
  return getRequestContext().env as CloudflareEnv;
}

export function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

export async function verifyRequestSession(
  req: Request,
  secret: string,
) {
  // 1) Authorization: Bearer <sessionToken> (desktop / cross-origin clients)
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = await verifySession(secret, token);
    if (session) return session;
  }
  // 2) Session cookie (browser flows on console.relaybase.xyz)
  const cookie = parseCookie(req.headers.get("Cookie") ?? "");
  return verifySession(secret, cookie[sessionCookieName()]);
}

export function setSessionCookieHeader(token: string): string {
  const name = sessionCookieName();
  return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

export function clearSessionCookieHeader(): string {
  const name = sessionCookieName();
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function assertEnv(env: CloudflareEnv, key: keyof CloudflareEnv): string {
  const v = env[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`Missing required secret: ${String(key)}`);
  }
  return v;
}

export function json(
  data: unknown,
  status = 200,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}
