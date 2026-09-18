// Probe existing Worker/R2/D1 resources before installing — mirrors
// desktop/src-tauri/src/auto_install/probe.rs (`probe_install_resources`).
import { NextRequest, NextResponse } from "next/server";
import {
  assertR2Subscription,
  accountWorkersDevUrl,
  countD1UserRows,
  countR2Objects,
  findD1Id,
  findR2Bucket,
  listD1Databases,
  listWorkerD1Bindings,
  workerHealthOk,
  workerScriptExists,
} from "@/server/cloudflare/client";
import { D1_DATABASES, DEFAULT_SCRIPT, R2_BUCKET } from "@/server/cloudflare/constants";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";
import { applyRefreshedCookie } from "@/server/cloudflare/session";

export type InstallResourceProbe = {
  kind: "worker" | "r2" | "d1";
  name: string;
  present: boolean;
  id: string;
  objectCount?: number | null;
  rowCount?: number | null;
  truncated?: boolean;
  occupied?: boolean;
};

export async function GET(request: NextRequest) {
  let session;
  let refreshedCookie: string | null;
  try {
    ({ session, refreshedCookie } = await requireCfSession(request));
  } catch (err) {
    if (err instanceof CfAuthRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
  if (!session.accountId) {
    return NextResponse.json(
      { error: "Authorize with Cloudflare again — no account id resolved" },
      { status: 401 },
    );
  }

  const client = { accountId: session.accountId, apiToken: session.accessToken };
  try {
    await assertR2Subscription(client);

    const resources: InstallResourceProbe[] = [];
    let workerPresent = await workerScriptExists(client, DEFAULT_SCRIPT);
    let workersDevUrl: string | null = null;
    if (!workerPresent) {
      try {
        workersDevUrl = await accountWorkersDevUrl(client, DEFAULT_SCRIPT);
        if (workersDevUrl && (await workerHealthOk(workersDevUrl))) {
          workerPresent = true;
        }
      } catch {
        /* metadata probe only */
      }
    }
    resources.push({ kind: "worker", name: DEFAULT_SCRIPT, present: workerPresent, id: "" });

    const r2Present = await findR2Bucket(client, R2_BUCKET);
    const r2: InstallResourceProbe = { kind: "r2", name: R2_BUCKET, present: r2Present, id: "" };
    if (r2Present) {
      const occ = await countR2Objects(client, R2_BUCKET);
      r2.objectCount = occ.unknown ? null : occ.count;
      r2.truncated = occ.truncated;
      r2.occupied = occ.occupied;
    }
    resources.push(r2);

    const workerD1 = workerPresent ? await listWorkerD1Bindings(client, DEFAULT_SCRIPT).catch(() => []) : [];
    const listedD1 = await listD1Databases(client).catch(() => [] as Array<[string, string]>);
    for (const [binding, name] of D1_DATABASES) {
      let id = workerD1.find(([b]) => b === binding)?.[1] ?? "";
      if (!id) id = listedD1.find(([n]) => n === name)?.[1] ?? "";
      if (!id) id = (await findD1Id(client, name).catch(() => null)) ?? "";
      const d1: InstallResourceProbe = { kind: "d1", name, present: Boolean(id), id };
      if (id) {
        const occ = await countD1UserRows(client, id);
        d1.rowCount = occ.unknown ? null : occ.count;
        d1.truncated = occ.truncated;
        d1.occupied = occ.occupied;
      }
      resources.push(d1);
    }

    if (workerPresent && !workersDevUrl) {
      workersDevUrl = await accountWorkersDevUrl(client, DEFAULT_SCRIPT).catch(() => null);
    }

    const response = NextResponse.json({ accountId: session.accountId, workersDevUrl, resources });
    // Persist a rotated refresh_token if Cloudflare issued one during the
    // session refresh above — otherwise the next request 401s.
    return applyRefreshedCookie(response, refreshedCookie);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
