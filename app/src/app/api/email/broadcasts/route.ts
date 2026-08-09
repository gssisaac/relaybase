import { NextResponse } from "next/server";

import {
  createBroadcastDraft,
  listContactsForGroups,
  readUserEmailData,
  requireSessionUserId,
  writeUserEmailData,
} from "@/lib/dev-email-store";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const domain = new URL(request.url).searchParams.get("domain")?.trim();
    return NextResponse.json({
      broadcasts: domain
        ? data.broadcasts.filter((b) => b.domain === domain)
        : data.broadcasts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

type CreateBroadcastBody = {
  groupIds?: string[];
  from?: string;
  subject?: string;
  text?: string;
  /** Default `draft`. Pass `sent` for legacy immediate-send callers. */
  status?: "draft" | "sent";
};

function errorStatus(message: string): number {
  if (message === "Not signed in") return 401;
  if (message.includes("not found")) return 404;
  return 400;
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as CreateBroadcastBody;
    const groupIds = (body.groupIds ?? []).filter(Boolean);
    const status = body.status === "sent" ? "sent" : "draft";

    if (status === "draft") {
      const broadcast = await createBroadcastDraft(userId, {
        groupIds,
        from: body.from,
        subject: body.subject,
        body: body.text,
      });
      return NextResponse.json({ broadcast });
    }

    // Immediate send (legacy / audience Send tab until migrated)
    const subject = body.subject?.trim() || "(untitled)";
    const from = body.from?.trim();
    if (groupIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one audience group" },
        { status: 400 },
      );
    }
    if (!from) {
      return NextResponse.json(
        { error: "Choose a From address" },
        { status: 400 },
      );
    }

    const data = await readUserEmailData(userId);
    const groups = data.audienceGroups.filter((g) => groupIds.includes(g.id));
    if (groups.length === 0) {
      return NextResponse.json(
        { error: "Audience group(s) not found" },
        { status: 404 },
      );
    }

    const recipients = listContactsForGroups(data, groupIds);
    const domain = from.split("@")[1]?.toLowerCase() || groups[0].domain;
    const broadcast = {
      id: crypto.randomUUID(),
      subject,
      status: "sent",
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      domain,
      groupIds,
      from,
      body: body.text,
      recipientCount: recipients.length,
    };
    data.broadcasts.unshift(broadcast);
    await writeUserEmailData(userId, data);
    return NextResponse.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json(
      { error: message },
      { status: errorStatus(message) },
    );
  }
}
