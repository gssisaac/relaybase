import { NextResponse } from "next/server";

import { requireSessionUserId } from "@/lib/dev-email-store";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireSessionUserId();
    const { id } = await params;
    return NextResponse.json({ ok: true, id, dev: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PATCH() {
  return NextResponse.json({ ok: true, dev: true });
}
