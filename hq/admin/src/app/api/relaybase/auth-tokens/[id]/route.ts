import { NextResponse } from "next/server";

import { revokeAuthTokenViaWorker } from "@/relaybase/lib/auth-token-client";
import { requireRelaybaseAdminAuth, RelaybaseAuthError } from "@/relaybase/lib/auth";
import { apiError } from "@/lib/api/api-error";

function relaybaseApiError(error: unknown) {
  if (error instanceof RelaybaseAuthError) {
    return apiError(error, 401);
  }
  return apiError(error);
}

type Props = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { id: tokenId } = await params;
    const cfg = await requireRelaybaseAdminAuth(request);
    const revoked = await revokeAuthTokenViaWorker(cfg, tokenId);
    if (!revoked) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return relaybaseApiError(error);
  }
}
