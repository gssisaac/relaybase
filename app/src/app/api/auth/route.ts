import { NextResponse } from "next/server";

import { ensureUserAuthToken } from "@/lib/dev-email-store";
import { getUser, upsertUser } from "@/lib/users-store";

function setSessionCookie(response: NextResponse, id: string) {
  response.cookies.set("relaybase_user", id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      action?: "signin" | "register";
    };

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const action = body.action ?? "signin";

    if (action === "register") {
      const existing = await getUser(id);
      if (existing) {
        return NextResponse.json(
          { error: "Account already exists — sign in instead" },
          { status: 409 },
        );
      }
      await upsertUser(id);
      await ensureUserAuthToken(id);
      const response = NextResponse.json({ ok: true, id, created: true });
      setSessionCookie(response, id);
      return response;
    }

    // MVP: no password — ID-only sign-in
    const existing = await getUser(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Account not found — create one with Register" },
        { status: 404 },
      );
    }

    await upsertUser(id);
    await ensureUserAuthToken(id);

    const response = NextResponse.json({ ok: true, id });
    setSessionCookie(response, id);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("relaybase_user");
  return response;
}
