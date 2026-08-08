import type { Context } from "hono";

import type { Env } from "../env";

const ALLOWED_ORIGINS = new Set([
  "https://relaybase.xyz",
  "https://www.relaybase.xyz",
  "http://localhost:32828",
  "http://127.0.0.1:32828",
]);

function applyCors(c: Context<{ Bindings: Env }>) {
  const origin = c.req.header("Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
  }
  c.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  c.header("Access-Control-Max-Age", "86400");
}

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

type WaitlistBody = {
  email?: string;
  source?: string;
};

export function waitlistOptions(c: Context<{ Bindings: Env }>) {
  applyCors(c);
  return c.body(null, 204);
}

export async function waitlistPost(c: Context<{ Bindings: Env }>) {
  applyCors(c);

  let body: WaitlistBody;
  try {
    body = await c.req.json<WaitlistBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return c.json({ error: "A valid email is required" }, 400);
  }

  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 64)
      : "get-started";
  const userAgent = c.req.header("user-agent")?.slice(0, 512) ?? null;

  if (!c.env.RELAYBASE_WAITLIST) {
    return c.json({ error: "Waitlist is not configured on this Worker" }, 503);
  }

  try {
    const result = await c.env.RELAYBASE_WAITLIST.prepare(
      `INSERT INTO waitlist (email, source, user_agent)
       VALUES (?, ?, ?)
       ON CONFLICT(email) DO NOTHING`,
    )
      .bind(email, source, userAgent)
      .run();

    const alreadyJoined = (result.meta.changes ?? 0) === 0;
    return c.json({ ok: true, alreadyJoined }, 200);
  } catch (error) {
    console.error("Waitlist insert failed", error);
    return c.json({ error: "Failed to join waitlist" }, 500);
  }
}
