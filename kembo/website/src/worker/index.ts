import { renderDownloadPage, renderNotFound } from "./download-page";
import {
  appendDownload,
  getInviteByEmail,
  getInviteByUuid,
  insertInvite,
} from "./invites";
import { resolveDmgUrl } from "./release";
import { sendBetaInviteEmail } from "./send";
import type { IncomingCf, InviteData, WorkerEnv } from "./types";
import { parseUserAgent } from "./ua";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const SITE_ORIGIN = "https://relaybase.xyz";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/beta" || path === "/api/beta/") {
      return handleBeta(request, env, url.origin);
    }

    const download = matchDownload(path);
    if (download) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405 });
      }
      return handleDownload(env, download.uuid, download.file);
    }

    return env.ASSETS.fetch(request);
  },
};

function matchDownload(
  path: string,
): { uuid: string; file: boolean } | null {
  const match = path.match(
    /^\/downloads\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(\/file)?\/?$/i,
  );
  if (!match) return null;
  return { uuid: match[1]!.toLowerCase(), file: Boolean(match[2]) };
}

async function handleBeta(
  request: Request,
  env: WorkerEnv,
  origin: string,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, request);
  }
  if (!env.DB) {
    return json({ error: "Beta signup is not configured" }, 503, request);
  }

  let body: { email?: string; timezone?: string };
  try {
    body = (await request.json()) as { email?: string; timezone?: string };
  } catch {
    return json({ error: "Invalid JSON body" }, 400, request);
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return json({ error: "A valid email is required" }, 400, request);
  }

  const timezone =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim().slice(0, 80)
      : undefined;

  const existing = await getInviteByEmail(env, email);
  const uuid = existing?.uuid ?? crypto.randomUUID();
  const alreadyJoined = Boolean(existing);

  if (!existing) {
    const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? "";
    const { browser, os } = parseUserAgent(userAgent);
    const cf = (request as Request & { cf?: IncomingCf }).cf;
    const data: InviteData = {
      email,
      createdAt: new Date().toISOString(),
      locale: {
        country: cf?.country,
        city: cf?.city,
        region: cf?.region,
        timezone: timezone ?? cf?.timezone,
      },
      browser,
      os,
      userAgent,
      downloads: [],
    };
    try {
      await insertInvite(env, uuid, data);
    } catch (error) {
      console.error("beta invite insert failed", error);
      return json({ error: "Failed to join the beta" }, 500, request);
    }
  }

  const sent = await sendBetaInviteEmail(
    env,
    email,
    `${origin || SITE_ORIGIN}/downloads/${uuid}`,
  );
  if (!sent.ok) {
    return json({ error: sent.error }, 502, request);
  }

  return json({ ok: true, alreadyJoined }, 200, request);
}

async function handleDownload(
  env: WorkerEnv,
  uuid: string,
  file: boolean,
): Promise<Response> {
  if (!UUID_RE.test(uuid) || !env.DB) {
    return renderNotFound();
  }

  const invite = await getInviteByUuid(env, uuid);
  if (!invite) {
    return renderNotFound();
  }

  const dmgUrl = await resolveDmgUrl(env);

  if (file) {
    if (!dmgUrl) {
      return new Response("Installer unavailable", { status: 503 });
    }
    await appendDownload(env, uuid, new Date().toISOString());
    return Response.redirect(dmgUrl, 302);
  }

  return renderDownloadPage({
    dmgUrl,
    filePath: `/downloads/${uuid}/file`,
  });
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (
    origin === "https://relaybase.xyz" ||
    origin === "https://www.relaybase.xyz" ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function json(
  data: unknown,
  status: number,
  req: Request,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
    },
  });
}
