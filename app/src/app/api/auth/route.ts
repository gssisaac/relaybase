import { NextResponse } from "next/server";

import { ensureUserAuthToken } from "@/lib/dev-email-store";
import { listUsers, upsertUser } from "@/lib/users-store";

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

    const existing = listUsers().some((u) => u.id === id);
    if (body.action === "register" && existing) {
      return NextResponse.json(
        { error: "This ID is already registered — sign in instead" },
        { status: 409 },
      );
    }

    upsertUser(id);
    ensureUserAuthToken(id);

    const response = NextResponse.json({ ok: true, id });
    response.cookies.set("relaybase_user", id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
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
