import { NextResponse } from "next/server";

import {
  requireSessionUserId,
  sendBroadcast,
} from "@/lib/dev-email-store";

type Params = { params: Promise<{ broadcastId: string }> };

function errorStatus(message: string): number {
  if (message === "Not signed in") return 401;
  if (message.includes("not found")) return 404;
  return 400;
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { broadcastId } = await params;
    const broadcast = await sendBroadcast(userId, broadcastId);
    return NextResponse.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json(
      { error: message },
      { status: errorStatus(message) },
    );
  }
}
