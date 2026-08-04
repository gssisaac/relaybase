import { NextResponse } from "next/server";

import {
  createUserApiKey,
  listUserApiKeys,
  parseStatsRange,
} from "@/lib/relaybase/user-api-keys";
import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const url = new URL(request.url);
    const range = parseStatsRange(url.searchParams.get("range"));
    const domain = resolveRequestDomain(request, data);
    if (url.searchParams.get("domain") && !domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const result = await listUserApiKeys({
      domains: data.domains,
      domain,
      range,
    });

    return NextResponse.json({
      keys: result.keys,
      workerConnected: result.workerConnected,
      range,
      domain,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Not signed in" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const body = (await request.json()) as { domain?: string; label?: string };
    const domain = body.domain?.trim().toLowerCase();
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const result = await createUserApiKey({
      domains: data.domains,
      domain,
      label: body.label,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      message === "Not signed in"
        ? 401
        : message.includes("not found") || message.includes("not configured")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
