import { NextResponse } from "next/server";

import {
  buildUserDetail,
  parseStatsRange,
} from "@/lib/admin/user-profile";
import { apiError } from "@/lib/api/api-error";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const range = parseStatsRange(searchParams.get("range"));
    const user = await buildUserDetail(id, range);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    return apiError(error);
  }
}
