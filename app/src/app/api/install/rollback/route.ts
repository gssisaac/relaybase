// Delete every Relaybase install resource (Worker, D1 x3, R2) in the
// connected Cloudflare account — mirrors
// desktop/src-tauri/src/auto_install/rollback.rs (`rollback_all_install`).
import { NextRequest, NextResponse } from "next/server";
import {
  countD1UserRows,
  countR2Objects,
  deleteD1Database,
  deleteR2Bucket,
  deleteWorkerScript,
  emptyR2Bucket,
  findD1Id,
  findR2Bucket,
  workerScriptExists,
  type CfClient,
} from "@/server/cloudflare/client";
import { D1_DATABASES, DEFAULT_SCRIPT, R2_BUCKET, wipeConfirmationAllows } from "@/server/cloudflare/constants";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";
import { COOKIE_NAMES } from "@/server/cloudflare/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let session;
  let refreshedCookie: string | null;
  try {
    ({ session, refreshedCookie } = await requireCfSession(request));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof CfAuthRequiredError ? err.message : String(err) },
      { status: 401 },
    );
  }
  const body = await request.json().catch(() => ({}));
  const accountId: string = (body.accountId?.trim?.() || session.accountId) as string;
  const wipeConfirmation: string | null = body.wipeConfirmation ?? null;
  if (!accountId) {
    return NextResponse.json({ error: "Authorize with Cloudflare again" }, { status: 401 });
  }
  const client: CfClient = { accountId, apiToken: session.accessToken };

  try {
    // Occupancy check — occupied resources require the DELETE ME phrase (or
    // the project/resource name), same as the desktop wipe gate.
    const occupiedNames: string[] = [];
    if (await workerScriptExists(client, DEFAULT_SCRIPT)) occupiedNames.push(DEFAULT_SCRIPT);
    if (await findR2Bucket(client, R2_BUCKET)) {
      const occ = await countR2Objects(client, R2_BUCKET);
      if (occ.occupied) occupiedNames.push(R2_BUCKET);
    }
    for (const [, name] of D1_DATABASES) {
      const id = await findD1Id(client, name);
      if (id) {
        const occ = await countD1UserRows(client, id);
        if (occ.occupied) occupiedNames.push(name);
      }
    }
    if (occupiedNames.length > 0 && !wipeConfirmationAllows(wipeConfirmation, occupiedNames)) {
      return NextResponse.json(
        {
          error: `These resources already have data (${occupiedNames.join(", ")}). Type DELETE ME or the resource name to permanently delete them.`,
        },
        { status: 409 },
      );
    }

    const failures: string[] = [];
    await deleteWorkerScript(client, DEFAULT_SCRIPT).catch((err) => failures.push(`Worker delete: ${err}`));
    for (const [, name] of D1_DATABASES) {
      const id = await findD1Id(client, name).catch(() => null);
      if (id) {
        await deleteD1Database(client, id).catch((err) => failures.push(`D1 ${name} delete: ${err}`));
      }
    }
    if (await findR2Bucket(client, R2_BUCKET).catch(() => false)) {
      try {
        await emptyR2Bucket(client, R2_BUCKET);
        await deleteR2Bucket(client, R2_BUCKET);
      } catch (err) {
        failures.push(`R2 delete: ${err}`);
      }
    }

    if (failures.length > 0) {
      return NextResponse.json({ error: failures.join("; ") }, { status: 500 });
    }
    const response = NextResponse.json({ ok: true });
    if (refreshedCookie) {
      response.cookies.set(COOKIE_NAMES.oauth, refreshedCookie, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
