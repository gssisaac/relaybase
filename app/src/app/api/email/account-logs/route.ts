import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
} from "@/lib/dev-email-store";
import {
  listInboundMessages,
  listWorkerSendLogs,
  readRelaybaseWorkerConfig,
} from "@/lib/relaybase/worker-client";

export type AccountLogEntry = {
  id: string;
  at: string;
  source: "api" | "dashboard" | "inbound";
  direction: "sent" | "received";
  ok: boolean;
  from: string;
  to: string;
  subject: string;
  error?: string;
  keyPrefix?: string | null;
  keyLabel?: string | null;
  status?: number | null;
};

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "all";
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? "100") || 100, 1),
      300,
    );

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email query param is required" },
        { status: 400 },
      );
    }

    const address = data.addresses.find(
      (entry) => entry.email.toLowerCase() === email,
    );
    if (!address) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const logs: AccountLogEntry[] = [];

    for (const entry of data.sent) {
      if (entry.from.toLowerCase() !== email) continue;
      logs.push({
        id: `dashboard:${entry.id}`,
        at: entry.sentAt,
        source: "dashboard",
        direction: "sent",
        ok: true,
        from: entry.from,
        to: entry.to,
        subject: entry.subject || "(no subject)",
      });
    }

    const cfg = await readRelaybaseWorkerConfig();
    let workerConnected = false;
    if (cfg) {
      workerConnected = true;
      try {
        const messages = await listInboundMessages(cfg, address.domain, 200);
        for (const message of messages) {
          if (message.toEmail.toLowerCase() !== email) continue;
          logs.push({
            id: `inbound:${message.key}`,
            at: message.receivedAt,
            source: "inbound",
            direction: "received",
            ok: message.status !== "failed",
            from: message.fromEmail,
            to: message.toEmail,
            subject: message.subject || "(no subject)",
            error: message.errorDetail || undefined,
          });
        }
      } catch {
        // inbound unavailable
      }

      try {
        const result = await listWorkerSendLogs(cfg, {
          limit: 500,
          domain: address.domain,
        });
        for (const log of result.logs) {
          if ((log.from ?? "").toLowerCase() !== email) continue;
          logs.push({
            id: `api:${log.id}`,
            at: log.at,
            source: "api",
            direction: "sent",
            ok: log.ok,
            from: log.from ?? email,
            to: log.to ?? "",
            subject: log.subject || "(no subject)",
            error: log.error,
            keyPrefix: log.keyPrefix,
            keyLabel: log.keyLabel,
            status: log.status,
          });
        }
      } catch {
        // api logs unavailable
      }
    }

    logs.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    const filtered =
      status === "failed"
        ? logs.filter((log) => !log.ok)
        : status === "success"
          ? logs.filter((log) => log.ok)
          : logs;

    const sliced = filtered.slice(0, limit);
    const summary = {
      total: filtered.length,
      success: filtered.filter((log) => log.ok).length,
      failed: filtered.filter((log) => !log.ok).length,
      api: filtered.filter((log) => log.source === "api").length,
      dashboard: filtered.filter((log) => log.source === "dashboard").length,
      inbound: filtered.filter((log) => log.source === "inbound").length,
    };

    return NextResponse.json({
      email: address.email,
      domain: address.domain,
      workerConnected,
      summary,
      logs: sliced,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
