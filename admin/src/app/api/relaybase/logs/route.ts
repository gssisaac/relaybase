import { NextResponse } from "next/server";

import { listEmailSenderLogs } from "@/relaybase/lib/client";
import { requireEmailSenderConfig } from "@/relaybase/lib/config";
import { apiError } from "@/lib/api/api-error";

export async function GET(request: Request) {
  try {
    const cfg = requireEmailSenderConfig();
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "100");
    const status = searchParams.get("status") ?? "all";
    const domain = searchParams.get("domain") ?? undefined;

    if (!["all", "failed", "success"].includes(status)) {
      return NextResponse.json(
        { error: "status must be all, failed, or success" },
        { status: 400 },
      );
    }

    const result = await listEmailSenderLogs(cfg, {
      limit: Number.isFinite(limit) ? limit : 100,
      status: status as "all" | "failed" | "success",
      domain,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
