import { NextResponse } from "next/server";

import {
  addManualAudienceContact,
  getAudienceGroupDetail,
  removeAudienceContact,
  requireSessionUserId,
} from "@/lib/dev-email-store";

type Params = { params: Promise<{ groupId: string }> };

function errorStatus(message: string): number {
  if (message === "Not signed in") return 401;
  if (message.includes("not found")) return 404;
  return 400;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { groupId } = await params;
    const detail = await getAudienceGroupDetail(userId, groupId);
    if (!detail) {
      return NextResponse.json(
        { error: "Audience group not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ contacts: detail.contacts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { groupId } = await params;
    const body = (await request.json()) as { email?: string; name?: string };
    if (!body.email?.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    const contact = await addManualAudienceContact(userId, groupId, {
      email: body.email,
      name: body.name,
    });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { groupId } = await params;
    const contactId = new URL(request.url).searchParams.get("contactId");
    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 },
      );
    }
    await removeAudienceContact(userId, groupId, contactId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
