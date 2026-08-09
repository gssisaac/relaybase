import { NextResponse } from "next/server";

import {
  getAudienceGroupProgress,
  requireSessionUserId,
} from "@/lib/dev-email-store";

type Params = { params: Promise<{ groupId: string }> };

function errorStatus(message: string): number {
  if (message === "Not signed in") return 401;
  if (message.includes("not found")) return 404;
  return 400;
}

/** Live sync/cron progress + recent history for the Progress tab. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { groupId } = await params;
    const progress = await getAudienceGroupProgress(userId, groupId);
    if (!progress) {
      return NextResponse.json(
        { error: "Audience group not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(progress);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
