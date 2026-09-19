import { NextRequest, NextResponse } from "next/server";

import { parseFeedbackBody } from "@/lib/feedback/feedback-record";
import { storeFeedbackInKv } from "@/lib/feedback/store-feedback-kv";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseFeedbackBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Message is required (max 8000 characters)" },
      { status: 400 },
    );
  }

  const id = parsed.id ?? crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? undefined;

  const result = await storeFeedbackInKv({
    id,
    message: parsed.message,
    contactEmail: parsed.contactEmail,
    pagePath: parsed.pagePath,
    userAgent,
    createdAt,
    account: parsed.account,
    images: parsed.images,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
