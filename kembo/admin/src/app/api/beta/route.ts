import { NextResponse } from "next/server";

import { listBetaInvites } from "@/lib/beta/invites";
import { apiError } from "@/lib/api/api-error";

export async function GET() {
  try {
    const result = await listBetaInvites();
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
