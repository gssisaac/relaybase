import { NextRequest, NextResponse } from "next/server";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";
import { applyRefreshedCookie } from "@/server/cloudflare/session";

/** Whether the browser has a valid Cloudflare install OAuth cookie (no tokens exposed). */
export async function GET(request: NextRequest) {
  try {
    const { session, refreshedCookie } = await requireCfSession(request);
    // Cloudflare rotates the refresh_token on every refresh; if we do not
    // write the rotated value back to the cookie here, the next poll (this
    // route is called frequently by the dashboard) sends the now-invalid
    // refresh_token and forces a full browser re-auth.
    const response = NextResponse.json({
      present: true,
      accountId: session.accountId || "",
      accountName: session.accountName || "",
    });
    return applyRefreshedCookie(response, refreshedCookie);
  } catch (err) {
    if (err instanceof CfAuthRequiredError) {
      return NextResponse.json({ present: false, accountId: "" });
    }
    throw err;
  }
}
