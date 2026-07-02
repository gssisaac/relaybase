import { NextResponse } from "next/server";

import {
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
    const data = readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (new URL(request.url).searchParams.get("domain") && !domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }
    if (!domain) {
      return NextResponse.json({ messages: [] });
    }

    const cfg = readRelaybaseWorkerConfig();
    if (!cfg) {
      return NextResponse.json({ messages: [] });
    }

    const limit = Number(new URL(request.url).searchParams.get("limit") ?? "50");
    const messages = await listInboundMessages(
      cfg,
      domain,
      Number.isFinite(limit) ? limit : 50,
    );
    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.includes("Unauthorized") || message.includes("401")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
