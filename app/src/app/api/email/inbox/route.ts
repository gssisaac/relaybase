import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
} from "@/lib/dev-email-store";

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const data = readUserEmailData(userId);
    return NextResponse.json({
      items: data.sent.map((s) => ({
        id: s.id,
        from: s.from,
        to: s.to,
        subject: s.subject,
        receivedAt: s.sentAt,
        direction: "outbound",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
