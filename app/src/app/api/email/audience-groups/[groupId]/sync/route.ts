import { NextResponse } from "next/server";

import { requireSessionUserId, syncAudienceGroup } from "@/lib/dev-email-store";

type Params = { params: Promise<{ groupId: string }> };

function errorStatus(message: string): number {
  if (message === "Not signed in") return 401;
  if (message.includes("not found")) return 404;
  return 400;
}

/** Manual "Refresh now" — runs the data source fetch synchronously and returns the result. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { groupId } = await params;
    const result = await syncAudienceGroup(userId, groupId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
