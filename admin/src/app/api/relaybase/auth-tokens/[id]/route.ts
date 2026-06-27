import { NextResponse } from "next/server";

import { revokeRelaybaseDashboardAuthToken } from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

type Props = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Props) {
  try {
    const { id: tokenId } = await params;
    if (!revokeRelaybaseDashboardAuthToken(tokenId)) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
