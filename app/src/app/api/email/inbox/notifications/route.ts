import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";
import {
  ackInboxNotifications,
  listInboxNotifications,
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

    const cfg = await readRelaybaseWorkerConfig();
    if (!cfg) {
      return NextResponse.json(
        { error: "Relaybase worker is not configured" },
        { status: 503 },
      );
    }

    const limit = Number(new URL(request.url).searchParams.get("limit") ?? "25");
    const events = await listInboxNotifications(
      cfg,
      domain,
      Number.isFinite(limit) ? limit : 25,
    );
    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.includes("Unauthorized") || message.includes("401")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);

    let body: { domain?: string; ids?: string[] };
    try {
      body = (await request.json()) as { domain?: string; ids?: string[] };
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

    const cfg = await readRelaybaseWorkerConfig();
    if (!cfg) {
      return NextResponse.json(
        { error: "Relaybase worker is not configured" },
        { status: 503 },
      );
    }

    const acked = await ackInboxNotifications(cfg, domain, ids);
    return NextResponse.json({ acked });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.includes("Unauthorized") || message.includes("401")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
