import { NextResponse } from "next/server";

import {
  buildUserEmailConfig,
  buildUserStats,
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";
import {
  listInboundMessages,
  readRelaybaseWorkerConfig,
} from "@/lib/relaybase/worker-client";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (!new URL(request.url).searchParams.get("domain")) {
      return NextResponse.json(
        { error: "domain query required" },
        { status: 400 },
      );
    }
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const stats = buildUserStats(data, domain, "7d");
    const config = await buildUserEmailConfig(userId);

    let routingActivityCount = 0;
    const worker = await readRelaybaseWorkerConfig();
    if (worker && domain) {
      try {
        const messages = await listInboundMessages(worker, domain, 50);
        routingActivityCount = messages.length;
      } catch {
        routingActivityCount = 0;
      }
    }

    return NextResponse.json({
      domain: domain ?? "",
      relaybaseConfigured: config.relaybaseConfigured,
      cloudflareConfigured: config.cloudflareConfigured,
      sendingEnabled: false,
      routingEnabled: false,
      dnsOk: 0,
      dnsTotal: 0,
      routingActivityCount,
      audienceCount: stats.totals.audience,
      senderCount: stats.totals.addresses,
      broadcastCount: stats.totals.broadcasts,
      broadcastsSent: stats.totals.broadcasts - stats.totals.drafts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
