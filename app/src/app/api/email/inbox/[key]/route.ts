import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";
import {
  getInboundMessage,
  readRelaybaseWorkerConfig,
} from "@/lib/relaybase/worker-client";

type Params = { params: Promise<{ key: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { key } = await params;
    const data = await readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const cfg = await readRelaybaseWorkerConfig();
    if (!cfg) {
      return NextResponse.json(
        { error: "Relaybase worker is not configured" },
        { status: 503 },
      );
    }

    const message = await getInboundMessage(cfg, domain, key);
    return NextResponse.json(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("Unauthorized") || message.includes("401")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
