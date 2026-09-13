import { NextRequest, NextResponse } from "next/server";
import { putWorkerSecret } from "@/server/cloudflare/client";
import { DEFAULT_SCRIPT } from "@/server/cloudflare/constants";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";

export async function POST(request: NextRequest) {
  let session;
  let refreshedCookie: string | null;
  try {
    ({ session, refreshedCookie } = await requireCfSession(request));
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof CfAuthRequiredError ? err.message : String(err) },
      { status: 401 },
    );
  }
  const body = await request.json().catch(() => ({}));
  const serverToken = String(body.serverToken ?? "").trim();
  const workerScriptName = String(body.workerScriptName ?? DEFAULT_SCRIPT).trim() || DEFAULT_SCRIPT;
  const accountId = String(body.accountId ?? session.accountId).trim();
  if (!serverToken) {
    return NextResponse.json({ ok: false, message: "Server token is empty." }, { status: 400 });
  }
  if (!accountId) {
    return NextResponse.json(
      { ok: false, message: "Authorize with Cloudflare again." },
      { status: 400 },
    );
  }
  try {
    const pushedAt = new Date().toISOString();
    await putWorkerSecret(
      { accountId, apiToken: session.accessToken },
      workerScriptName,
      "CF_API_TOKEN",
      serverToken,
    );
    const response = NextResponse.json({
      ok: true,
      message: "Server token pushed to Worker as CF_API_TOKEN.",
      pushedAt,
    });
    if (refreshedCookie) {
      const { COOKIE_NAMES } = await import("@/server/cloudflare/session");
      response.cookies.set(COOKIE_NAMES.oauth, refreshedCookie, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Push failed" },
      { status: 500 },
    );
  }
}
