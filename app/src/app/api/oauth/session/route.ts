import { NextRequest, NextResponse } from "next/server";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";

/** Whether the browser has a valid Cloudflare install OAuth cookie (no tokens exposed). */
export async function GET(request: NextRequest) {
  try {
    const { session } = await requireCfSession(request);
    return NextResponse.json({
      present: true,
      accountId: session.accountId || "",
    });
  } catch (err) {
    if (err instanceof CfAuthRequiredError) {
      return NextResponse.json({ present: false, accountId: "" });
    }
    throw err;
  }
}
