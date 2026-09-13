import { NextRequest, NextResponse } from "next/server";
import { enableWorkersDev, type CfClient } from "@/server/cloudflare/client";
import { DEFAULT_SCRIPT } from "@/server/cloudflare/constants";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";

/** Compare the OAuth account's workers.dev URL with the saved Worker URL (web update gate). */
export async function GET(request: NextRequest) {
  let session;
  try {
    ({ session } = await requireCfSession(request));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof CfAuthRequiredError ? err.message : "Unauthorized" },
      { status: 401 },
    );
  }

  const saved = request.nextUrl.searchParams.get("workerUrl")?.trim().replace(/\/$/, "");
  if (!saved) {
    return NextResponse.json({ error: "workerUrl query param is required" }, { status: 400 });
  }

  const accountId = session.accountId?.trim();
  if (!accountId) {
    return NextResponse.json(
      { error: "Cloudflare account id missing — authorize again" },
      { status: 401 },
    );
  }

  const client: CfClient = { accountId, apiToken: session.accessToken };
  const accountWorkerUrl = (await enableWorkersDev(client, DEFAULT_SCRIPT)).replace(/\/$/, "");
  const matches = accountWorkerUrl === saved;

  return NextResponse.json({
    matches,
    savedWorkerUrl: saved,
    accountWorkerUrl,
    workerScriptName: DEFAULT_SCRIPT,
  });
}
