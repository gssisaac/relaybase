import { NextResponse } from "next/server";

import {
  buildUserEmailConfig,
  requireSessionUserId,
} from "@/lib/dev-email-store";

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const config = buildUserEmailConfig(userId);
    const domain = config.emailDomain || config.domain || "";

    return NextResponse.json({
      domain,
      zoneId: null,
      cloudflareConfigured: config.cloudflareConfigured,
      sendingOnboarded: false,
      sendingEnabled: false,
      sendingDnsConfigured: false,
      routingEnabled: false,
      sendingSubdomainId: null,
      returnPathDomain: null,
      cloudflareSendingUrl: null,
      dnsRecords: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
