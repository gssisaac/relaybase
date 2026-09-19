import { NextRequest, NextResponse } from "next/server";

import {
  cfVerifyTokenErrorMessage,
  validateCfApiTokenInput,
} from "@/lib/cloudflare/validate-cf-api-token";

const CF_API = "https://api.cloudflare.com/client/v4";

/** Minimal server-token verification (Zone Read probe). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const accountId = String(body.accountId ?? "").trim();
  const tokenCheck = validateCfApiTokenInput(String(body.apiToken ?? ""));
  if (!accountId) {
    return NextResponse.json(
      { ok: false, accountId: "", message: "Account id is required." },
      { status: 400 },
    );
  }
  if (!tokenCheck.ok) {
    return NextResponse.json({ ok: false, accountId, message: tokenCheck.message }, { status: 400 });
  }
  const apiToken = tokenCheck.token;
  try {
    const res = await fetch(`${CF_API}/user/tokens/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });
    const value = await res.json().catch(() => ({}));
    if (!res.ok || value?.success === false) {
      const msg =
        cfVerifyTokenErrorMessage(value) ??
        value?.errors?.[0]?.message ??
        `Token verification failed (HTTP ${res.status})`;
      return NextResponse.json({ ok: false, accountId, message: msg });
    }
    const zones = await fetch(
      `${CF_API}/zones?account.id=${encodeURIComponent(accountId)}&per_page=1`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );
    if (!zones.ok) {
      return NextResponse.json({
        ok: false,
        accountId,
        message: "Token could not list zones (Zone Read required).",
      });
    }
    return NextResponse.json({
      ok: true,
      accountId,
      message: "Token verified.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        accountId,
        message: err instanceof Error ? err.message : "Verification failed",
      },
      { status: 500 },
    );
  }
}
