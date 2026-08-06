import { NextResponse } from "next/server";

import { normalizeDomain, requireSessionUserId } from "@/lib/dev-email-store";
import { getZoneConnectionStatus } from "@/lib/relaybase/domain-onboard";

/**
 * Live Cloudflare zone lookup used by the "Connect domain" guide. Separate
 * from onboarding advance/retry so users can poll for a zone becoming
 * available without mutating onboarding state.
 */
export async function GET(request: Request) {
  try {
    await requireSessionUserId();
    const url = new URL(request.url);
    const domain = normalizeDomain(url.searchParams.get("domain") ?? "");
    if (!domain) {
      return NextResponse.json(
        { error: "domain is required" },
        { status: 400 },
      );
    }

    const status = await getZoneConnectionStatus(domain);
    return NextResponse.json({ domain, ...status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message.includes("signed in") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
