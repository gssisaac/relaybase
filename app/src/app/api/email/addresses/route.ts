import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
  writeUserEmailData,
} from "@/lib/dev-email-store";
import {
  ensureInboundWorkerRouting,
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

    const addresses = domain
      ? data.addresses.filter((a) => a.domain === domain)
      : data.addresses;

    return NextResponse.json({ addresses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as { localPart?: string };
    const localPart = body.localPart?.trim();
    if (!localPart) {
      return NextResponse.json(
        { error: "localPart is required" },
        { status: 400 },
      );
    }

    const data = readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (!domain) {
      return NextResponse.json(
        { error: "Select a domain before adding senders" },
        { status: 400 },
      );
    }

    const email = `${localPart}@${domain}`.toLowerCase();
    const cfg = readRelaybaseWorkerConfig();
    if (!cfg) {
      return NextResponse.json(
        {
          error:
            "Relaybase worker is not configured. Ask your operator to finish setup before adding senders.",
        },
        { status: 503 },
      );
    }

    try {
      await ensureInboundWorkerRouting(cfg, {
        domain,
        addresses: [email],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to configure inbound routing";
      return NextResponse.json(
        {
          error: `Could not enable inbox for ${email}: ${message}`,
        },
        { status: 502 },
      );
    }

    if (!data.addresses.some((a) => a.email.toLowerCase() === email)) {
      data.addresses.push({ email, domain });
      writeUserEmailData(userId, data);
    }
    return NextResponse.json({ address: { email } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
