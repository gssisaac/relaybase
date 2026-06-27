import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
  writeUserEmailData,
} from "@/lib/dev-email-store";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (new URL(request.url).searchParams.get("domain") && !domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const broadcasts = domain
      ? data.broadcasts.filter((b) => b.domain === domain)
      : data.broadcasts;

    return NextResponse.json({ broadcasts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as { subject?: string };
    const data = readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (!domain) {
      return NextResponse.json(
        { error: "Select a domain before creating broadcasts" },
        { status: 400 },
      );
    }

    const broadcast = {
      id: crypto.randomUUID(),
      subject: body.subject?.trim() || "(untitled)",
      status: "draft",
      createdAt: new Date().toISOString(),
      domain,
    };
    data.broadcasts.unshift(broadcast);
    writeUserEmailData(userId, data);
    return NextResponse.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
