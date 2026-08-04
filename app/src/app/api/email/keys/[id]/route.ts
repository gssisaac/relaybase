import { NextResponse } from "next/server";

import {
  activateUserApiKey,
  deleteUserApiKey,
} from "@/lib/relaybase/user-api-keys";
import {
  readUserEmailData,
  requireSessionUserId,
} from "@/lib/dev-email-store";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const { id } = await params;
    const keyId = id?.trim();
    if (!keyId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteUserApiKey({ domains: data.domains, id: keyId });
    return NextResponse.json({ ok: true, id: keyId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      message === "Not signed in"
        ? 401
        : message.includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const { id } = await params;
    const keyId = id?.trim();
    if (!keyId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const result = await activateUserApiKey({
      domains: data.domains,
      id: keyId,
    });
    return NextResponse.json({ ok: true, id: keyId, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      message === "Not signed in"
        ? 401
        : message.includes("not found") || message.includes("not stored")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
