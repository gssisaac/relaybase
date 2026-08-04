import { NextResponse } from "next/server";

import {
  collectUserApiStats,
  parseStatsRange,
} from "@/lib/relaybase/user-api-keys";
import {
  buildUserStats,
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = await readUserEmailData(userId);
    const url = new URL(request.url);
    const range = parseStatsRange(url.searchParams.get("range"));
    const domain = resolveRequestDomain(request, data);
    if (url.searchParams.get("domain") && !domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const [local, api] = await Promise.all([
      Promise.resolve(buildUserStats(data, domain, range)),
      collectUserApiStats({
        domains: data.domains,
        domain,
        range,
      }),
    ]);

    return NextResponse.json({
      ...local,
      workerConnected: api.workerConnected,
      totals: {
        ...local.totals,
        apiKeys: api.totals.apiKeys,
        apiKeysUsed: api.totals.apiKeysUsed,
        requests: api.totals.requests,
        errors: api.totals.errors,
        apiEmails: api.totals.emails,
      },
      series: {
        ...local.series,
        apiKeysUsed: api.series.apiKeysUsed,
        requests: api.series.requests,
        errors: api.series.errors,
        apiEmails: api.series.emails,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
