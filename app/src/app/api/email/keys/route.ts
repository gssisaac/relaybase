import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
} from "@/lib/dev-email-store";

export async function GET() {
  try {
    await requireSessionUserId();
    return NextResponse.json({ keys: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Dev mode — API keys are not provisioned yet" },
    { status: 501 },
  );
}

export async function PUT() {
  return NextResponse.json({ ok: true, message: "Dev mode — settings saved locally" });
}
