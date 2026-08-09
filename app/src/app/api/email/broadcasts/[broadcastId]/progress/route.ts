import { NextResponse } from "next/server";

import {
  getBroadcastProgress,
  requireSessionUserId,
} from "@/lib/dev-email-store";

type Params = { params: Promise<{ broadcastId: string }> };

function errorStatus(message: string): number {
  if (message === "Not signed in") return 401;
  if (message.includes("not found")) return 404;
  return 400;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { broadcastId } = await params;
    const progress = await getBroadcastProgress(userId, broadcastId);
    if (!progress) {
      return NextResponse.json(
        { error: "Broadcast not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(progress);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json(
      { error: message },
      { status: errorStatus(message) },
    );
  }
}
