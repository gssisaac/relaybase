import { NextResponse } from "next/server";

import {
  collectAdminStats,
  parseStatsRange,
} from "@/lib/admin/stats";
import { apiError } from "@/lib/api/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = parseStatsRange(searchParams.get("range"));
    const stats = await collectAdminStats(range);
    return NextResponse.json(stats);
  } catch (error) {
    return apiError(error);
  }
}
