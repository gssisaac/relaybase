import { NextResponse } from "next/server";

import { requireSessionUserId } from "@/lib/dev-email-store";

export async function GET() {
  try {
    await requireSessionUserId();
    return NextResponse.json({
      configured: false,
      healthy: false,
      cloudflareConfigured: false,
      relaybaseConfigured: false,
      domainStatus: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
