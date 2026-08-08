import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
  writeUserEmailData,
} from "@/lib/dev-email-store";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (!new URL(request.url).searchParams.get("domain")) {
      return NextResponse.json(
        { error: "domain query required" },
        { status: 400 },
      );
    }
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    return NextResponse.json({
      contacts: data.audience.filter((c) => c.domain === domain),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as { email?: string; name?: string };
    const email = body.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const data = await readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (!domain) {
      return NextResponse.json(
        { error: "Select a domain before adding contacts" },
        { status: 400 },
      );
    }

    if (!data.audience.some((c) => c.email === email && c.domain === domain)) {
      data.audience.push({
        email,
        name: body.name?.trim() || undefined,
        domain,
      });
      await writeUserEmailData(userId, data);
    }
    return NextResponse.json({ contact: { email, domain } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
