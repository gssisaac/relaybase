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
    return NextResponse.json({ addresses: data.addresses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as { localPart?: string };
    const localPart = body.localPart?.trim();
    if (!localPart) {
      return NextResponse.json(
        { error: "localPart is required" },
        { status: 400 },
      );
    }

    const data = readUserEmailData(userId);
    const email = `${localPart}@${data.config.domain}`;
    if (!data.addresses.some((a) => a.email === email)) {
      data.addresses.push({ email });
      writeUserEmailData(userId, data);
    }
    return NextResponse.json({ address: { email } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
