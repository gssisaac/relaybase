import { NextResponse } from "next/server";

import {
  getActiveDomain,
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
  writeUserEmailData,
} from "@/lib/dev-email-store";
import { parseEmailListStrict } from "@/lib/email/parse-recipients";
import { sendViaRelaybaseWorker } from "@/lib/relaybase/send-email";
import { readRelaybaseWorkerConfig } from "@/lib/relaybase/worker-client";

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
      items: sent,
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
    const from = body.from ?? `dev@${domain}`;
    const subject = body.subject ?? "(no subject)";
    const text = body.text?.trim() ?? "";

    let messageId = crypto.randomUUID();
    const workerConfigured = Boolean(readRelaybaseWorkerConfig());

    if (workerConfigured) {
      const result = await sendViaRelaybaseWorker({
        domain,
        from,
        to: toParsed.emails.length === 1 ? toParsed.emails[0]! : toParsed.emails,
        cc: ccParsed.emails.length
          ? ccParsed.emails.length === 1
            ? ccParsed.emails[0]
            : ccParsed.emails
          : undefined,
        subject,
        text,
      });
      messageId = result.messageId;
    }

    const record = {
      id: crypto.randomUUID(),
      from,
      to: toParsed.emails.join(", "),
      cc: ccParsed.emails.length ? ccParsed.emails.join(", ") : undefined,
      subject,
      bodyPreview: text,
      sentAt: new Date().toISOString(),
      domain,
      messageId,
    };
    data.sent.unshift(record);
    writeUserEmailData(userId, data);
    return NextResponse.json({ messageId: record.messageId, sent: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.includes("Unauthorized") || message.includes("401")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
