import { NextResponse } from "next/server";

import {
  buildUserStats,
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";

type StatsRange = "24h" | "7d" | "30d";

function parseRange(value: string | null): StatsRange {
  if (value === "24h" || value === "30d") return value;
  return "7d";
}

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = readUserEmailData(userId);
    const url = new URL(request.url);
    const range = parseRange(url.searchParams.get("range"));
    const domain = resolveRequestDomain(request, data);
    if (url.searchParams.get("domain") && !domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    return NextResponse.json(buildUserStats(data, domain, range));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
