import { NextRequest, NextResponse } from "next/server";

import { ownerSetupAdmin } from "@/server/cloudflare/schema";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";
import { applyRefreshedCookie, readSignupStagingCookie } from "@/server/cloudflare/session";
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

  let body: {
    username?: string;
    password?: string;
    confirmPassword?: string;
    installToken?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const staging = readSignupStagingCookie(body.installToken);
  if (!staging) {
    return NextResponse.json({ error: "Install session expired. Run setup again." }, { status: 400 });
  }

  const accountId = cfSession.accountId.trim().toLowerCase();
  if (!accountId || staging.accountId.trim().toLowerCase() !== accountId) {
    return NextResponse.json(
      { error: "Cloudflare account does not match the install session." },
      { status: 403 },
    );
  }

  let passtoken: string;
  try {
    ({ passtoken } = await ownerSetupAdmin(staging.workerUrl, staging.authPepper));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not provision owner credentials." },
      { status: 502 },
    );
  }

  const studioRes = await fetch(studioAuthUrl("/auth/signup/cloud"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Relaybase-Internal-Auth": internalStudioAuthHeader(),
    },
    body: JSON.stringify({
      username: body.username,
      password: body.password,
      confirmPassword: body.confirmPassword,
      cfAccountId: accountId,
      workerUrl: staging.workerUrl,
      passtoken,
    }),
  });

  const payload = await studioRes.json().catch(() => ({}));
  if (!studioRes.ok) {
    return NextResponse.json(
      { error: payload.error ?? "Signup failed" },
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
