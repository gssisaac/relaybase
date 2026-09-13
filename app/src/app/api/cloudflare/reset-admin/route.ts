import { NextRequest, NextResponse } from "next/server";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";

/** Forgot-passtoken recovery on web — uses the sealed OAuth cookie, not a client token. */
export async function POST(request: NextRequest) {
  let session;
  try {
    ({ session } = await requireCfSession(request));
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof CfAuthRequiredError
            ? err.message
            : "Authorize with Cloudflare first",
      },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    workerUrl?: string;
  };
  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "");
  if (!workerUrl) {
    return NextResponse.json({ error: "workerUrl is required" }, { status: 400 });
  }

  const res = await fetch(`${workerUrl}/console/reset-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cfAccessToken: session.accessToken }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    passtoken?: string;
    error?: string;
  };
  if (!res.ok || !data.passtoken) {
    return NextResponse.json(
      { error: data.error || `Reset failed (${res.status})` },
      { status: res.status >= 400 ? res.status : 502 },
    );
  }
  return NextResponse.json({ passtoken: data.passtoken });
}
