import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";
import {
  readRelaybaseWorkerConfig,
  setInboundReadState,
} from "@/lib/relaybase/worker-client";

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);

    let body: { domain?: string; ids?: string[]; read?: boolean };
    try {
      body = (await request.json()) as {
        domain?: string;
        ids?: string[];
        read?: boolean;
      };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const domainParam = body.domain?.trim().toLowerCase();
    if (!domainParam) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const probe = new URL(request.url);
    probe.searchParams.set("domain", domainParam);
    const domain = resolveRequestDomain(
      new Request(probe.toString(), { method: "GET" }),
      data,
    );
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
    if (!ids?.length) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
        { status: 400 },
      );
    }

    if (typeof body.read !== "boolean") {
      return NextResponse.json(
        { error: "read must be a boolean" },
        { status: 400 },
      );
    }

    const cfg = await readRelaybaseWorkerConfig();
    if (!cfg) {
      return NextResponse.json(
        { error: "Relaybase worker is not configured" },
        { status: 503 },
      );
    }

    const result = await setInboundReadState(cfg, domain, ids, body.read);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.includes("Unauthorized") || message.includes("401")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
