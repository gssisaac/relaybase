import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  writeUserEmailData,
} from "@/lib/dev-email-store";

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const data = readUserEmailData(userId);
    return NextResponse.json({ sent: data.sent, items: [] });
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
    const record = {
      id: crypto.randomUUID(),
      from: body.from ?? "dev@example.com",
      to: body.to ?? "",
      subject: body.subject ?? "(no subject)",
      sentAt: new Date().toISOString(),
    };
    data.sent.unshift(record);
    writeUserEmailData(userId, data);
    return NextResponse.json({ messageId: record.id, dev: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
