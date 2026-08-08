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
    const body = (await request.json()) as {
      domain?: string;
      action?: "start" | "advance" | "retry";
    };
    const domain = normalizeDomain(body.domain ?? "");
    const action = body.action ?? "advance";

    if (!domain) {
      return NextResponse.json(
        { error: "domain is required" },
        { status: 400 },
      );
    }

    const data = await readUserEmailData(userId);
    if (!data.domains.includes(domain)) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const result =
      action === "start"
        ? await startDomainOnboarding(userId, domain)
        : action === "retry"
          ? await retryDomainOnboarding(userId, domain)
          : await advanceDomainOnboarding(userId, domain);

    return NextResponse.json({
      domains: result.domains,
      onboarding: result.onboarding,
      message: result.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      message.includes("Not signed in") || message.includes("signed in")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
