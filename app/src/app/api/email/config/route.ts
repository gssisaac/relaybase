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
      ...data.config,
      configured: false,
      healthy: false,
      workerUrl: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
