import { NextResponse } from "next/server";

import { sendEmailWithApiKey } from "@/relaybase/lib/client";
import { requireEmailSenderConfig } from "@/relaybase/lib/config";
import {
  getEmailSenderVaultKey,
  recordEmailSenderSentEmail,
} from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      keyId?: string;
      from?: string;
      fromName?: string;
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
      replyTo?: string;
    };

    const keyId = body.keyId?.trim();
    const from = body.from?.trim();
    const to = body.to?.trim();
    const subject = body.subject?.trim();
    const text = body.text?.trim();

    if (!keyId || !from || !to || !subject || !text) {
      return NextResponse.json(
        { error: "keyId, from, to, subject, and text are required" },
        { status: 400 },
      );
    }

    const vaultKey = getEmailSenderVaultKey(keyId);
    if (!vaultKey?.key) {
      return NextResponse.json(
        {
          error:
            "API key not found in local vault — re-issue the key or copy it from API Keys",
        },
        { status: 400 },
      );
    }

    if (!from.toLowerCase().endsWith(`@${vaultKey.domain.toLowerCase()}`)) {
      return NextResponse.json(
        { error: `From address must be on ${vaultKey.domain}` },
        { status: 403 },
      );
    }

    const cfg = requireEmailSenderConfig();
    const result = await sendEmailWithApiKey(cfg.baseUrl, vaultKey.key, {
      from,
      fromName: body.fromName?.trim() || undefined,
      to,
      subject,
      text,
      html: body.html,
      replyTo: body.replyTo,
    });

    const sent = recordEmailSenderSentEmail({
      keyId: vaultKey.id,
      keyLabel: vaultKey.label,
      domain: vaultKey.domain,
      from,
      to,
      subject,
      bodyPreview: text,
      messageId: result.messageId,
    });

    return NextResponse.json({ messageId: result.messageId, sent });
  } catch (error) {
    return apiError(error, 502);
  }
}
