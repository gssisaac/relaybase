import { NextResponse } from "next/server";

import {
  buildUserStats,
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (new URL(request.url).searchParams.get("domain") && !domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const stats = buildUserStats(data, domain, "7d");

    return NextResponse.json({
      metrics: {
        domain: domain ?? "",
        relaybaseConfigured: data.config.relaybaseConfigured,
        cloudflareConfigured: data.config.cloudflareConfigured,
        sendingEnabled: false,
        routingEnabled: false,
        dnsOk: 0,
        dnsTotal: 0,
        routingActivityCount: 0,
        audienceCount: stats.totals.audience,
        senderCount: stats.totals.addresses,
        broadcastCount: stats.totals.broadcasts,
        broadcastsSent: stats.totals.broadcasts - stats.totals.drafts,
      },
      domains: data.domains,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
