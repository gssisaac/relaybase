import { NextResponse } from "next/server";

import { listWorkerSendLogs } from "@/relaybase/lib/worker-logs";
import type { EmailSenderSentEmail } from "@/relaybase/components/types";
import { apiError } from "@/lib/api/api-error";

/**
 * Sent-mail list now reads from the product worker's R2 send-log store
 * via `/console/send-logs`. The legacy local `sentEmails` cache in the
 * operations KV has been removed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "100");
    const result = await listWorkerSendLogs({
      limit: Number.isFinite(limit) ? limit : 100,
      status: "success",
    });

    const sent: EmailSenderSentEmail[] = result.logs.map((log) => ({
      id: log.id,
      keyId: log.keyId ?? "",
      keyLabel: log.keyLabel,
      domain: log.domain ?? "",
      from: log.from ?? "",
      to: log.to ?? "",
      subject: log.subject ?? "",
      bodyPreview: log.error ?? "",
      messageId: log.messageId ?? "",
      sentAt: log.at,
    }));

    return NextResponse.json({ sent });
  } catch (error) {
    return apiError(error);
  }
}
