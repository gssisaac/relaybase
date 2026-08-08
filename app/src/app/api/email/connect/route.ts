import { NextResponse } from "next/server";

import {
  normalizeDomain,
  readUserEmailData,
  requireSessionUserId,
} from "@/lib/dev-email-store";
import {
  advanceDomainOnboarding,
  retryDomainOnboarding,
  startDomainOnboarding,
} from "@/lib/relaybase/domain-onboard";

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json().catch(() => ({}))) as {
      domain?: string;
      mode?: "sending" | "routing" | "all";
      action?: "start" | "advance" | "retry";
    };

    const data = await readUserEmailData(userId);
    const domain = normalizeDomain(body.domain ?? "");

    if (!domain || !data.domains.includes(domain)) {
      return NextResponse.json(
        { error: "domain is required" },
        { status: 400 },
      );
    }

    const existing = data.domainOnboarding?.[domain];
    const action =
      body.action ??
      (existing?.status === "failed"
        ? "retry"
        : existing
          ? "advance"
          : "start");

    const result =
      action === "start"
        ? await startDomainOnboarding(userId, domain)
        : action === "retry"
          ? await retryDomainOnboarding(userId, domain)
          : await advanceDomainOnboarding(userId, domain);

    return NextResponse.json({
      ok: result.onboarding?.status === "ready",
      domains: result.domains,
      onboarding: result.onboarding,
      message: result.message,
      mode: body.mode ?? "all",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message.includes("Not signed in") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
