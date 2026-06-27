import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  writeUserEmailData,
} from "@/lib/dev-email-store";

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const data = readUserEmailData(userId);
    return NextResponse.json({ contacts: data.audience });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as { email?: string; name?: string };
    const email = body.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    const data = readUserEmailData(userId);
    if (!data.audience.some((c) => c.email === email)) {
      data.audience.push({ email, name: body.name?.trim() || undefined });
      writeUserEmailData(userId, data);
    }
    return NextResponse.json({ contact: { email } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
