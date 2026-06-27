import { NextResponse } from "next/server";

import { listUserSummaries } from "@/lib/admin/user-profile";
import { apiError } from "@/lib/api/api-error";

export async function GET() {
  try {
    const users = await listUserSummaries();
    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error);
  }
}
