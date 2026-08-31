import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { waitlist } from "@/db/schema";
import { getEnv } from "@/lib/env";


const ALLOWED_ORIGINS = new Set([
  "https://relaybase.xyz",
  "https://www.relaybase.xyz",
  "http://localhost:32828",
  "http://127.0.0.1:32828",
]);

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const env = await getEnv();
  if (!env.DB) {
    return json({ error: "Waitlist is not configured" }, 503, cors);
  }

  let body: { email?: string; source?: string };
  try {
    body = (await req.json()) as { email?: string; source?: string };
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return json({ error: "A valid email is required" }, 400, cors);
  }

  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 64)
      : "get-started";
  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;

  try {
    const db = getDb(env);
    const existing = await db.select({ id: waitlist.id }).from(waitlist)
      .where(eq(waitlist.email, email)).get();
    const alreadyJoined = Boolean(existing);
    if (!alreadyJoined) {
      await db.insert(waitlist).values({
        email,
        createdAt: new Date().toISOString(),
        source,
        userAgent,
      });
    }
    return json({ ok: true, alreadyJoined }, 200, cors);
  } catch (error) {
    console.error("Waitlist insert failed", error);
    return json({ error: "Failed to join waitlist" }, 500, cors);
  }
}
