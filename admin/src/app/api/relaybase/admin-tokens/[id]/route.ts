import { NextResponse } from "next/server";

import { revokeRelaybaseDashboardAdminToken } from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const tokenId = id?.trim();
    if (!tokenId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (!revokeRelaybaseDashboardAdminToken(tokenId)) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: tokenId });
  } catch (error) {
    return apiError(error);
  }
}
