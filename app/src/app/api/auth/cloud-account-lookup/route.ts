import { NextRequest, NextResponse } from "next/server";

import { internalStudioAuthHeader, studioAuthUrl } from "@/server/auth/internal-studio";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";
import { applyRefreshedCookie } from "@/server/cloudflare/session";

export async function GET(request: NextRequest) {
  let session;
  let refreshedCookie: string | null;
  try {
    ({ session, refreshedCookie } = await requireCfSession(request));
  } catch (err) {
    const message =
      err instanceof CfAuthRequiredError ? err.message : "Cloudflare authorization required";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const accountId = session.accountId?.trim().toLowerCase();
  if (!accountId) {
    return NextResponse.json({ error: "No Cloudflare account on session" }, { status: 401 });
  }

  let internalAuth: string;
  try {
    internalAuth = await internalStudioAuthHeader();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server auth is misconfigured." },
      { status: 503 },
    );
  }

  const studioRes = await fetch(
    await studioAuthUrl(
      `/auth/cloud-account-lookup?cfAccountId=${encodeURIComponent(accountId)}`,
    ),
    {
      headers: { "X-Relaybase-Internal-Auth": internalAuth },
      cache: "no-store",
    },
  );
  const payload = (await studioRes.json().catch(() => ({}))) as {
    exists?: boolean;
    username?: string;
    error?: string;
  };
  if (!studioRes.ok) {
    return NextResponse.json(
      { error: payload.error ?? "Could not look up account" },
      { status: studioRes.status },
    );
  }

  const response = NextResponse.json({
    exists: Boolean(payload.exists),
    username: payload.username?.trim() || undefined,
    cfAccountId: accountId,
    cfAccountName: session.accountName || "",
  });
  return applyRefreshedCookie(response, refreshedCookie);
}
