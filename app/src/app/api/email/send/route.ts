import { NextResponse } from "next/server";

import {
  getActiveDomain,
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
  writeUserEmailData,
} from "@/lib/dev-email-store";
import { parseEmailListStrict } from "@/lib/email/parse-recipients";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    const sent = domain
      ? data.sent.filter((s) => s.domain === domain)
      : data.sent;
    return NextResponse.json({
      sent: sent.map((entry) => ({
        ...entry,
        bodyPreview: entry.bodyPreview ?? "",
      })),
      items: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as {
      from?: string;
      to?: string | string[];
      cc?: string | string[];
      subject?: string;
      text?: string;
    };

    const toInput = Array.isArray(body.to) ? body.to.join(", ") : (body.to ?? "");
    const ccInput = Array.isArray(body.cc) ? body.cc.join(", ") : (body.cc ?? "");
    const toParsed = parseEmailListStrict(toInput);
    const ccParsed = parseEmailListStrict(ccInput);
    const invalid = [...toParsed.invalid, ...ccParsed.invalid];

    if (!toParsed.emails.length) {
      return NextResponse.json(
        { error: "At least one valid To address is required" },
        { status: 400 },
      );
    }
    if (invalid.length) {
      return NextResponse.json(
        { error: `Invalid email address: ${invalid.join(", ")}` },
        { status: 400 },
      );
    }

    const data = readUserEmailData(userId);
    const domain =
      resolveRequestDomain(request, data) ??
      body.from?.split("@")[1]?.toLowerCase() ??
      getActiveDomain(data) ??
      "example.com";
    const record = {
      id: crypto.randomUUID(),
      from: body.from ?? `dev@${domain}`,
      to: toParsed.emails.join(", "),
      cc: ccParsed.emails.length ? ccParsed.emails.join(", ") : undefined,
      subject: body.subject ?? "(no subject)",
      bodyPreview: body.text?.trim() ?? "",
      sentAt: new Date().toISOString(),
      domain,
    };
    data.sent.unshift(record);
    writeUserEmailData(userId, data);
    return NextResponse.json({ messageId: record.id, dev: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
