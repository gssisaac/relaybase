import { NextResponse } from "next/server";

import { requireSessionUserId } from "@/lib/dev-email-store";

type Params = { params: Promise<{ key: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireSessionUserId();
    const { key } = await params;
    return NextResponse.json({
      key,
      subject: "(dev)",
      from: "dev@example.com",
      text: "Dev mode — no inbound mail stored.",
      html: null,
      attachments: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
