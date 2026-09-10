import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/api-error";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth/passkey";

export async function POST() {
  try {
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(ADMIN_SESSION_COOKIE);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
