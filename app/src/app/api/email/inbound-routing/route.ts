import { NextResponse } from "next/server";

import { requireSessionUserId } from "@/lib/dev-email-store";

export async function GET() {
  try {
    await requireSessionUserId();
    return NextResponse.json({ routes: [], configured: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PUT() {
  return NextResponse.json({ ok: true, dev: true });
}
