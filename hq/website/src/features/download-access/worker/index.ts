import { trackDirectDeviceDownload } from "./device-invite";
import { parseTrackBody } from "./parse-track-body";
import type { WorkerEnv } from "@/worker/types";

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

export async function handleDirectDownloadTrack(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request),
      },
    });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request),
      },
    });
  }

  const body = parseTrackBody(raw);
  if (!body) {
    return new Response(JSON.stringify({ error: "A valid clientId is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request),
      },
    });
  }

  const result = await trackDirectDeviceDownload(request, env, body);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request),
      },
    });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}
