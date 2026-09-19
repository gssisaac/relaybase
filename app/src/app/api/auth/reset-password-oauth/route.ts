import { NextRequest, NextResponse } from "next/server";

import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";
import { applyRefreshedCookie } from "@/server/cloudflare/session";
import { internalStudioAuthHeader, studioAuthUrl } from "@/server/auth/internal-studio";

export async function POST(request: NextRequest) {
  let cfSession;
  let refreshedCookie: string | null;
  try {
    ({ session: cfSession, refreshedCookie } = await requireCfSession(request));
  } catch (err) {
    const message =
      err instanceof CfAuthRequiredError ? err.message : "Cloudflare authorization required";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  let body: { newPassword?: string; confirmPassword?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cfAccountId = cfSession.accountId.trim();
  if (!cfAccountId) {
    return NextResponse.json({ error: "Cloudflare account id missing." }, { status: 400 });
  }

  const studioRes = await fetch(studioAuthUrl("/auth/reset-password/oauth"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Relaybase-Internal-Auth": internalStudioAuthHeader(),
    },
    body: JSON.stringify({
      cfAccountId,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
    }),
  });

  const payload = await studioRes.json().catch(() => ({}));
  if (!studioRes.ok) {
    return NextResponse.json(
      { error: payload.error ?? "Password reset failed" },
      { status: studioRes.status },
    );
  }

  const response = NextResponse.json(payload);
  const setCookie = studioRes.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookie) {
    response.headers.append("Set-Cookie", cookie);
  }
  return applyRefreshedCookie(response, refreshedCookie);
}
