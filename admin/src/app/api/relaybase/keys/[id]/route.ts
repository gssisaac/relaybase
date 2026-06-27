import { NextResponse } from "next/server";

import { deleteEmailSenderKey } from "@/relaybase/lib/client";
import { requireRelaybaseAdminAuth, RelaybaseAuthError } from "@/relaybase/lib/auth";
import { removeEmailSenderKeyFromVault } from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

function relaybaseApiError(error: unknown) {
  if (error instanceof RelaybaseAuthError) {
    return apiError(error, 401);
  }
  return apiError(error);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const keyId = id.trim();
    const cfg = await requireRelaybaseAdminAuth(request);
    try {
      await deleteEmailSenderKey(cfg, keyId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("(404)") && !message.includes("not found")) {
        throw error;
      }
    }
    removeEmailSenderKeyFromVault(keyId);
    return NextResponse.json({ ok: true, id: keyId });
  } catch (error) {
    return relaybaseApiError(error);
  }
}
