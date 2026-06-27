import { NextResponse } from "next/server";

import { listUsers } from "@/lib/users-store";

export async function GET() {
  return NextResponse.json({ users: listUsers() });
}
