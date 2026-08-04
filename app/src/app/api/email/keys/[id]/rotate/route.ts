import { NextResponse } from "next/server";

import { rotateUserApiKey } from "@/lib/relaybase/user-api-keys";
import {
  readUserEmailData,
  requireSessionUserId,
} from "@/lib/dev-email-store";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const { id } = await params;
    const keyId = id?.trim();
    if (!keyId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const result = await rotateUserApiKey({
      domains: data.domains,
      id: keyId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      message === "Not signed in"
        ? 401
        : message.includes("not found") || message.includes("not configured")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
