import { NextRequest, NextResponse } from "next/server";
import { ownerSetupAdmin } from "@/server/cloudflare/schema";

/** Web install — issue owner passtoken server-side (avoids browser CORS to workers.dev). */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    workerUrl?: string;
    pepper?: string;
  };
  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "");
  const pepper = body.pepper?.trim() ?? "";
  if (!workerUrl) {
    return NextResponse.json({ error: "workerUrl is required" }, { status: 400 });
  }
  if (!pepper) {
    return NextResponse.json({ error: "pepper is required" }, { status: 400 });
  }

  try {
    const { passtoken } = await ownerSetupAdmin(workerUrl, pepper);
    return NextResponse.json({ passtoken });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Setup failed" },
      { status: 502 },
    );
  }
}
