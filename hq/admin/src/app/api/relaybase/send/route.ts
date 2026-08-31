import { NextResponse } from "next/server";

import { sendEmailWithAdminToken } from "@/relaybase/lib/client";
import { requireEmailSenderConfig } from "@/relaybase/lib/config";
import { apiError } from "@/lib/api/api-error";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      keyId?: string;
      keyLabel?: string;
      domain?: string;
      from?: string;
      fromName?: string;
      to?: string | string[];
      cc?: string | string[];
      subject?: string;
      text?: string;
      html?: string;
      replyTo?: string;
    };

    const from = body.from?.trim();
    const toInput = Array.isArray(body.to) ? body.to.join(", ") : (body.to ?? "");
    const ccInput = Array.isArray(body.cc) ? body.cc.join(", ") : (body.cc ?? "");
    const subject = body.subject?.trim();
    const text = body.text?.trim();

    if (!from || !toInput || !subject || !text) {
      return NextResponse.json(
        { error: "from, to, subject, and text are required" },
        { status: 400 },
      );
    }

    const cfg = await requireEmailSenderConfig();
    const result = await sendEmailWithAdminToken(cfg, {
      from,
      fromName: body.fromName?.trim() || undefined,
      to: body.to ?? toInput,
      cc: body.cc ?? (ccInput || undefined),
      subject,
      text,
      html: body.html,
      replyTo: body.replyTo,
    });

    return NextResponse.json({ messageId: result.messageId });
  } catch (error) {
    return apiError(error, 502);
  }
}
