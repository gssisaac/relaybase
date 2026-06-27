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
    return NextResponse.json({ broadcasts: data.broadcasts });
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
    const broadcast = {
      id: crypto.randomUUID(),
      subject: body.subject?.trim() || "(untitled)",
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    data.broadcasts.unshift(broadcast);
    writeUserEmailData(userId, data);
    return NextResponse.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
