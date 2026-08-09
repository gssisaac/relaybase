import { NextResponse } from "next/server";

import {
  getBroadcastDetail,
  requireSessionUserId,
  updateBroadcastDraft,
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
    const detail = await getBroadcastDetail(userId, broadcastId);
    if (!detail) {
      return NextResponse.json(
        { error: "Broadcast not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json(
      { error: message },
      { status: errorStatus(message) },
    );
  }
}

type PatchBody = {
  groupIds?: string[];
  from?: string | null;
  subject?: string;
  text?: string;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { broadcastId } = await params;
    const body = (await request.json()) as PatchBody;
    const broadcast = await updateBroadcastDraft(userId, broadcastId, {
      groupIds: body.groupIds,
      from: body.from,
      subject: body.subject,
      body: body.text,
    });
    return NextResponse.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json(
      { error: message },
      { status: errorStatus(message) },
    );
  }
}
