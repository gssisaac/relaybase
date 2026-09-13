import { NextRequest, NextResponse } from "next/server";

const CF_API = "https://api.cloudflare.com/client/v4";

/** Minimal server-token verification (Zone Read probe). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const accountId = String(body.accountId ?? "").trim();
  const apiToken = String(body.apiToken ?? "").trim();
  if (!accountId || !apiToken) {
    return NextResponse.json(
      { ok: false, accountId: "", message: "Account id and API token are required." },
      { status: 400 },
    );
  }
  try {
    const res = await fetch(`${CF_API}/accounts/${accountId}/tokens/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const value = await res.json().catch(() => ({}));
    if (!res.ok || value?.success === false) {
      const msg =
        value?.errors?.[0]?.message ??
        `Token verification failed (HTTP ${res.status})`;
      return NextResponse.json({ ok: false, accountId, message: msg });
    }
    const zones = await fetch(`${CF_API}/zones?per_page=1`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
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
