import { NextResponse } from "next/server";

import {
  normalizeDomain,
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";
import {
  getInboundMessage,
  readRelaybaseWorkerConfig,
} from "@/lib/relaybase/worker-client";

type Params = { params: Promise<{ key: string }> };

function isNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("not found");
}

export async function GET(request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { key } = await params;
    const data = await readUserEmailData(userId);
    const url = new URL(request.url);
    const explicitDomain = normalizeDomain(url.searchParams.get("domain") ?? "");
    const resolved = resolveRequestDomain(request, data);

    if (explicitDomain && !resolved) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const cfg = await readRelaybaseWorkerConfig();
    if (!cfg) {
      return NextResponse.json(
        { error: "Relaybase worker is not configured" },
        { status: 503 },
      );
    }

    // Prefer the requested domain, then other owned domains (multi-domain
    // mailboxes may omit ?domain= and need a scan across owned domains).
    const candidates = explicitDomain
      ? [explicitDomain]
      : [
          ...(resolved ? [resolved] : []),
          ...data.domains.filter((d) => d !== resolved),
        ];

    let lastNotFound: Error | null = null;
    for (const domain of candidates) {
      try {
        const message = await getInboundMessage(cfg, domain, key);
        return NextResponse.json(message);
      } catch (error) {
        if (isNotFound(error)) {
          lastNotFound = error instanceof Error ? error : new Error("Message not found");
          continue;
        }
        throw error;
      }
    }

    // Last resort: worker id-only lookup (no domain hint).
    if (!explicitDomain) {
      try {
        const message = await getInboundMessage(cfg, undefined, key);
        return NextResponse.json(message);
      } catch (error) {
        if (!isNotFound(error)) throw error;
        lastNotFound =
          error instanceof Error ? error : new Error("Message not found");
      }
    }

    return NextResponse.json(
      { error: lastNotFound?.message ?? "Message not found" },
      { status: 404 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.includes("Unauthorized") || message.includes("401")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
