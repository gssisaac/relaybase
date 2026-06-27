import { NextResponse } from "next/server";

import {
  buildUserEmailConfig,
  readUserEmailData,
  requireSessionUserId,
  writeUserEmailData,
  addUserDomain,
  setActiveUserDomain,
} from "@/lib/dev-email-store";

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    return NextResponse.json(buildUserEmailConfig(userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as {
      emailDomain?: string;
      relaybaseAuthToken?: string;
      credentialSource?: "integration" | "manual";
    };

    const data = readUserEmailData(userId);

    if (body.emailDomain !== undefined) {
      const domain = body.emailDomain.trim();
      if (domain) {
        addUserDomain(userId, domain);
        setActiveUserDomain(userId, domain);
      }
    }
    if (body.relaybaseAuthToken !== undefined) {
      data.config.relaybaseAuthToken = body.relaybaseAuthToken.trim();
      data.config.relaybaseConfigured = Boolean(body.relaybaseAuthToken.trim());
      writeUserEmailData(userId, data);
    }

    const config = buildUserEmailConfig(userId);
    return NextResponse.json({
      ...config,
      message: "Settings saved",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}
