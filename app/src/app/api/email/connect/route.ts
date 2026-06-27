import { NextResponse } from "next/server";

import { requireSessionUserId } from "@/lib/dev-email-store";

export async function POST() {
  try {
    await requireSessionUserId();
    return NextResponse.json({
      ok: true,
      dev: true,
      message: "Dev mode — connect is not wired to Cloudflare",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
