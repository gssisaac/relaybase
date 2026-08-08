import { NextResponse } from "next/server";

import {
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
    if (!requested) {
      return NextResponse.json(
        { error: "domain query required" },
        { status: 400 },
      );
    }
    if (!data.domains.includes(requested)) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const status = await buildDomainStatusFromOnboarding(userId, requested);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
