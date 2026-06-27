import { NextResponse } from "next/server";

import {
  getActiveDomain,
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
    const sent = domain
      ? data.sent.filter((s) => s.domain === domain)
      : data.sent;
    return NextResponse.json({ sent, items: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as {
      from?: string;
      to?: string;
      subject?: string;
      text?: string;
    };
    const data = readUserEmailData(userId);
    const domain =
      resolveRequestDomain(request, data) ??
      body.from?.split("@")[1]?.toLowerCase() ??
      getActiveDomain(data) ??
      "example.com";
    const record = {
      id: crypto.randomUUID(),
      from: body.from ?? `dev@${domain}`,
      to: body.to ?? "",
      subject: body.subject ?? "(no subject)",
      sentAt: new Date().toISOString(),
      domain,
    };
    data.sent.unshift(record);
    writeUserEmailData(userId, data);
    return NextResponse.json({ messageId: record.id, dev: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
