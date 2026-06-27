import { NextResponse } from "next/server";

import { listUserLogs } from "@/lib/admin/user-profile";
import { apiError } from "@/lib/api/api-error";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "100");
    const status = searchParams.get("status") ?? "all";

    if (!["all", "failed", "success"].includes(status)) {
      return NextResponse.json(
        { error: "status must be all, failed, or success" },
        { status: 400 },
      );
    }

    const result = await listUserLogs(id, {
      limit: Number.isFinite(limit) ? limit : 100,
      status: status as "all" | "failed" | "success",
    });

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
