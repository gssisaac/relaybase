import { NextResponse } from "next/server";

import {
  getActiveDomain,
  normalizeDomain,
  readUserEmailData,
  requireSessionUserId,
} from "@/lib/dev-email-store";
import { buildDomainStatusFromOnboarding } from "@/lib/relaybase/domain-onboard";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const url = new URL(request.url);
    const requested = normalizeDomain(url.searchParams.get("domain") ?? "");
    const domain =
      (requested && data.domains.includes(requested) ? requested : null) ??
      getActiveDomain(data) ??
      "";

    if (!domain) {
      return NextResponse.json({
        domain: "",
        zoneId: null,
        cloudflareConfigured: false,
        sendingOnboarded: false,
        sendingEnabled: false,
        sendingDnsConfigured: false,
        routingEnabled: false,
        sendingSubdomainId: null,
        returnPathDomain: null,
        cloudflareSendingUrl: null,
        dnsRecords: [],
        onboarding: null,
      });
    }

    const status = await buildDomainStatusFromOnboarding(userId, domain);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
