import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/api-error";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  createSessionToken,
  isAdminPasskeyConfigured,
  verifyPasskey,
} from "@/lib/auth/passkey";

export async function POST(request: Request) {
  try {
    if (!isAdminPasskeyConfigured()) {
      return apiError(
        new Error("ADMIN_PASSKEY is not configured on the server"),
        500,
      );
    }

    const body = (await request.json().catch(() => null)) as {
      passkey?: unknown;
    } | null;
    const passkey = typeof body?.passkey === "string" ? body.passkey : "";

    if (!passkey || !(await verifyPasskey(passkey))) {
      return apiError(new Error("Invalid passkey"), 401);
    }

    const token = await createSessionToken();
    if (!token) {
      return apiError(
        new Error("ADMIN_PASSKEY is not configured on the server"),
        500,
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
