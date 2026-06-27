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
      metrics: {
        sent24h: data.sent.length,
        delivered24h: 0,
        failed24h: 0,
        bounced24h: 0,
      },
      domains: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
