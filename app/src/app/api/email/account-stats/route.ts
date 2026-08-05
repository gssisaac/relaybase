import { NextResponse } from "next/server";

import {
  parseStatsRange,
  type StatsBucket,
  type StatsRange,
} from "@/lib/relaybase/user-api-keys";
import {
  readUserEmailData,
  requireSessionUserId,
} from "@/lib/dev-email-store";
import {
  listInboundMessages,
  listWorkerSendLogs,
  readRelaybaseWorkerConfig,
} from "@/lib/relaybase/worker-client";

function rangeMs(range: StatsRange): number {
  if (range === "24h") return 24 * 60 * 60 * 1000;
  if (range === "30d") return 30 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

function bucketCount(range: StatsRange): number {
  if (range === "24h") return 24;
  if (range === "30d") return 30;
  return 7;
}

function emptyBuckets(range: StatsRange): StatsBucket[] {
  const count = bucketCount(range);
  return Array.from({ length: count }, (_, index) => ({
    value: 0,
    label: range === "24h" ? `${index}h` : `D${index + 1}`,
  }));
}

function bucketIndex(
  timestamp: number,
  range: StatsRange,
  now: number,
): number | null {
  const span = rangeMs(range);
  const count = bucketCount(range);
  const since = now - span;
  if (timestamp < since || timestamp > now) return null;
  const bucketMs = span / count;
  return Math.min(count - 1, Math.floor((timestamp - since) / bucketMs));
}

function bump(buckets: StatsBucket[], index: number | null) {
  if (index === null) return;
  buckets[index]!.value += 1;
}

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
    const range = parseStatsRange(url.searchParams.get("range"));

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

    const domain = address.domain;
    const now = Date.now();
    const since = now - rangeMs(range);

    const receivedBuckets = emptyBuckets(range);
    const sentBuckets = emptyBuckets(range);
    const apiEmailBuckets = emptyBuckets(range);
    const apiErrorBuckets = emptyBuckets(range);

    let receivedTotal = 0;
    let sentTotal = 0;
    let apiEmails = 0;
    let apiErrors = 0;
    let apiRequests = 0;

    for (const entry of data.sent) {
      if (entry.from.toLowerCase() !== email) continue;
      const ts = new Date(entry.sentAt).getTime();
      if (ts < since) continue;
      sentTotal += 1;
      bump(sentBuckets, bucketIndex(ts, range, now));
    }

    const cfg = await readRelaybaseWorkerConfig();
    if (cfg) {
      try {
        const messages = await listInboundMessages(cfg, domain, 200);
        for (const message of messages) {
          if (message.toEmail.toLowerCase() !== email) continue;
          const ts = new Date(message.receivedAt).getTime();
          if (ts < since) continue;
          receivedTotal += 1;
          bump(receivedBuckets, bucketIndex(ts, range, now));
        }
      } catch {
        // inbox unavailable — keep zeros
      }

      try {
        const { logs } = await listWorkerSendLogs(cfg, { limit: 500 });
        for (const log of logs) {
          if ((log.from ?? "").toLowerCase() !== email) continue;
          const ts = new Date(log.at).getTime();
          if (ts < since) continue;
          apiRequests += 1;
          if (log.ok) {
            apiEmails += 1;
            bump(apiEmailBuckets, bucketIndex(ts, range, now));
          } else {
            apiErrors += 1;
            bump(apiErrorBuckets, bucketIndex(ts, range, now));
          }
        }
      } catch {
        // logs unavailable
      }
    }

    return NextResponse.json({
      email: address.email,
      displayName: address.displayName ?? null,
      domain,
      range,
      totals: {
        received: receivedTotal,
        sent: sentTotal,
        apiRequests,
        apiEmails,
        apiErrors,
      },
      series: {
        received: receivedBuckets,
        sent: sentBuckets,
        apiEmails: apiEmailBuckets,
        apiErrors: apiErrorBuckets,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
