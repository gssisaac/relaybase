import { NextResponse } from "next/server";

import { suggestedDisplayNameForLocalPart } from "@/lib/dashboard/default-addresses";
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
    const data = await readUserEmailData(userId);
    const url = new URL(request.url);
    // Personal mail picker needs every domain's addresses — not just activeDomain.
    if (url.searchParams.get("all") === "1") {
      return NextResponse.json({ addresses: data.addresses });
    }

    const domain = resolveRequestDomain(request, data);
    if (url.searchParams.get("domain") && !domain) {
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
    const body = (await request.json()) as {
      localPart?: string;
      localParts?: string[];
      displayName?: string;
      displayNames?: Record<string, string>;
    };

    const localParts = (
      Array.isArray(body.localParts) && body.localParts.length
        ? body.localParts
        : body.localPart
          ? [body.localPart]
          : []
    )
      .map((part) => part.trim())
      .filter(Boolean);

    if (!localParts.length) {
      return NextResponse.json(
        { error: "localPart or localParts is required" },
        { status: 400 },
      );
    }

    const data = await readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (!domain) {
      return NextResponse.json(
        { error: "Select a domain before adding senders" },
        { status: 400 },
      );
    }

    const emails = [
      ...new Set(localParts.map((part) => `${part}@${domain}`.toLowerCase())),
    ];

    const cfg = await readRelaybaseWorkerConfig();
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
        addresses: emails,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to configure inbound routing";
      return NextResponse.json(
        {
          error: `Could not enable inbox for ${emails.join(", ")}: ${message}`,
        },
        { status: 502 },
      );
    }

    const singleDisplayName =
      typeof body.displayName === "string" ? body.displayName.trim() : "";

    const added: {
      email: string;
      domain: string;
      displayName?: string;
    }[] = [];
    let mutated = false;
    for (const email of emails) {
      const local = email.slice(0, email.indexOf("@"));
      const fromMap =
        typeof body.displayNames?.[local] === "string"
          ? body.displayNames[local]!.trim()
          : "";
      const displayName =
        fromMap ||
        (emails.length === 1 ? singleDisplayName : "") ||
        suggestedDisplayNameForLocalPart(local);

      const existingIndex = data.addresses.findIndex(
        (a) => a.email.toLowerCase() === email,
      );
      if (existingIndex < 0) {
        const address = {
          email,
          domain,
          ...(displayName ? { displayName } : {}),
        };
        data.addresses.push(address);
        added.push(address);
        mutated = true;
      } else {
        const current = data.addresses[existingIndex]!;
        if (displayName && !current.displayName?.trim()) {
          const updated = { ...current, displayName };
          data.addresses[existingIndex] = updated;
          added.push(updated);
          mutated = true;
        } else {
          added.push(current);
        }
      }
    }
    if (mutated) await writeUserEmailData(userId, data);

    if (emails.length === 1) {
      return NextResponse.json({ address: added[0], addresses: added });
    }
    return NextResponse.json({ addresses: added });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as {
      email?: string;
      displayName?: string | null;
    };
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const data = await readUserEmailData(userId);
    const index = data.addresses.findIndex(
      (a) => a.email.toLowerCase() === email,
    );
    if (index < 0) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const displayName =
      typeof body.displayName === "string"
        ? body.displayName.trim()
        : body.displayName === null
          ? ""
          : undefined;

    if (displayName !== undefined) {
      const current = data.addresses[index]!;
      data.addresses[index] = {
        email: current.email,
        domain: current.domain,
        ...(displayName ? { displayName } : {}),
      };
      await writeUserEmailData(userId, data);
    }

    return NextResponse.json({ address: data.addresses[index] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
