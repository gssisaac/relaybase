// Runs the full Cloudflare auto-install pipeline and streams progress as
// Server-Sent Events. Mirrors desktop/src-tauri/src/auto_install/install.rs
// (`auto_install_worker` / `auto_install_steps`), adapted to a single
// request/response cycle since Next.js Route Handlers are stateless.
//
// Auth is the sealed `rb_cf_oauth` cookie set by /api/oauth/callback.
// Browsers' native EventSource is GET-only and cannot send custom headers,
// so install options travel as query params.
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  assertR2Subscription,
  countD1UserRows,
  countR2Objects,
  createD1Database,
  deleteD1Database,
  deleteR2Bucket,
  emptyR2Bucket,
  enableWorkersDev,
  ensureR2Bucket,
  findR2Bucket,
  listD1Databases,
  listWorkerBindings,
  listWorkerSecrets,
  putWorkerSchedules,
  putWorkerSecret,
  uploadWorkerScript,
  type CfClient,
} from "@/server/cloudflare/client";
import {
  D1_DATABASES,
  DEFAULT_SCRIPT,
  R2_BUCKET,
  wipeConfirmationAllows,
} from "@/server/cloudflare/constants";
import { fetchInstallManifest, stageInstallPackage } from "@/server/cloudflare/manifest";
import { CfAuthRequiredError, requireCfSession } from "@/server/cloudflare/require-session";
import {
  fetchOwnerConfigured,
  fetchWorkerVersion,
  initWorkerDb,
  migrateWorkerDb,
  ownerSetupAdmin,
  waitForWorkerReady,
} from "@/server/cloudflare/schema";
import { applyRefreshedCookie } from "@/server/cloudflare/session";

export const runtime = "nodejs";
export const maxDuration = 300;

type Decision = { kind: string; name: string; action: "skip" | "reinstall" };

function generateAuthPepper(): string {
  return randomBytes(32).toString("hex");
}

export async function GET(request: NextRequest) {
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
  const accountId = request.nextUrl.searchParams.get("accountId")?.trim() || session.accountId;
  if (!accountId) {
    return NextResponse.json({ error: "Authorize with Cloudflare again" }, { status: 401 });
  }
  let decisions: Decision[] = [];
  try {
    decisions = JSON.parse(request.nextUrl.searchParams.get("decisions") ?? "[]");
  } catch {
    decisions = [];
  }
  const wipeConfirmation = request.nextUrl.searchParams.get("wipeConfirmation");
  const mode =
    request.nextUrl.searchParams.get("mode") === "update" ? "update" : "install";

  const client: CfClient = { accountId, apiToken: session.accessToken };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const log = (step: string, level: "info" | "stderr", line: string) => send("log", { step, level, line });

      try {
        const existingD1 = await listD1Databases(client).catch(() => []);

        // 1. R2
        log("r2", "info", "Checking that R2 is enabled on this Cloudflare account…");
        await assertR2Subscription(client);
        const r2Decision = decisions.find((d) => d.kind === "r2");
        if (r2Decision?.action === "reinstall" && (await findR2Bucket(client, R2_BUCKET))) {
          const occ = await countR2Objects(client, R2_BUCKET);
          if (occ.occupied && !wipeConfirmationAllows(wipeConfirmation, [R2_BUCKET])) {
            throw new Error(
              `${R2_BUCKET} already has data. Type DELETE ME or the resource name to permanently delete it.`,
            );
          }
          log("r2", "info", `Reinstall — emptying and deleting R2 ${R2_BUCKET}…`);
          await emptyR2Bucket(client, R2_BUCKET).catch(() => {});
          await deleteR2Bucket(client, R2_BUCKET);
        }
        log("r2", "info", `Ensuring R2 bucket ${R2_BUCKET}…`);
        await ensureR2Bucket(client, R2_BUCKET);
        log("r2", "info", `R2 bucket ${R2_BUCKET} ready`);

        // 2. D1
        const d1Ids: string[] = [];
        let anyD1Reused = false;
        for (const [, dbName] of D1_DATABASES) {
          const decision = decisions.find((d) => d.kind === "d1" && d.name === dbName);
          const existing = existingD1.find(([n]) => n === dbName);
          if (decision?.action === "reinstall" && existing) {
            const occ = await countD1UserRows(client, existing[1]);
            if (occ.occupied && !wipeConfirmationAllows(wipeConfirmation, [dbName])) {
              throw new Error(
                `${dbName} already has data. Type DELETE ME or the resource name to permanently delete it.`,
              );
            }
            log("d1", "info", `Reinstall — deleting D1 ${dbName}…`);
            await deleteD1Database(client, existing[1]);
            log("d1", "info", `Creating D1 ${dbName}…`);
            d1Ids.push(await createD1Database(client, dbName));
          } else if (existing) {
            anyD1Reused = true;
            d1Ids.push(existing[1]);
          } else {
            log("d1", "info", `Creating D1 ${dbName}…`);
            d1Ids.push(await createD1Database(client, dbName));
          }
          log("d1", "info", `D1 ${dbName} ready (id ${d1Ids[d1Ids.length - 1]})`);
        }

        // 3. Deploy worker
        log("prepare", "info", "Fetching Worker install manifest…");
        const manifest = await fetchInstallManifest();
        const staged = await stageInstallPackage(manifest, (line) => log("prepare", "info", line));

        log("deploy", "info", `Uploading Worker \`${DEFAULT_SCRIPT}\`…`);
        const d1ForUpload = D1_DATABASES.map(([binding], i) => ({ binding, id: d1Ids[i] }));
        await uploadWorkerScript(
          client,
          DEFAULT_SCRIPT,
          staged.workerJs,
          R2_BUCKET,
          d1ForUpload,
          staged.version,
          staged.desktopVersion ?? "unknown",
        );
        const bindings = await listWorkerBindings(client, DEFAULT_SCRIPT).catch(() => []);
        log(
          "deploy",
          "info",
          `Worker bindings: ${bindings.length ? bindings.map((b) => `${b.kind}:${b.name}`).join(", ") : "(none)"}`,
        );
        await putWorkerSchedules(client, DEFAULT_SCRIPT, "*/15 * * * *").catch((err) =>
          log("deploy", "stderr", `Could not set Worker cron: ${err}`),
        );
        const workerUrl = await enableWorkersDev(client, DEFAULT_SCRIPT);
        log("deploy", "info", `Deployed at ${workerUrl}`);

        // 4. Secrets
        const existingSecrets = await listWorkerSecrets(client, DEFAULT_SCRIPT).catch(
          (): string[] => [],
        );
        const alreadyHasPepper = existingSecrets.includes("AUTH_PEPPER");
        let authPepper: string | undefined;
        if (mode === "update" && alreadyHasPepper) {
          log("secret", "info", "AUTH_PEPPER unchanged (Worker update)");
        } else {
          authPepper = generateAuthPepper();
          await putWorkerSecret(client, DEFAULT_SCRIPT, "AUTH_PEPPER", authPepper);
          log("secret", "info", alreadyHasPepper ? "AUTH_PEPPER rotated" : "AUTH_PEPPER secret set");
        }
        await putWorkerSecret(client, DEFAULT_SCRIPT, "CF_ACCOUNT_ID", accountId);
        log("secret", "info", "CF_ACCOUNT_ID secret set");

        // 5. Warm up + schema
        await waitForWorkerReady(workerUrl, (line) => log("warmup", "info", line));

        const ownerAlreadyConfigured =
          mode === "update" ? true : await fetchOwnerConfigured(workerUrl);
        const useMigrate = mode === "update" || anyD1Reused || ownerAlreadyConfigured;
        const step = useMigrate ? "migrate-db" : "init-db";
        const cfAccessForSchema =
          mode === "update" && !authPepper ? session.accessToken : undefined;
        let dbApplied: string[] = [];
        let dbAlreadyInitialized = false;
        try {
          const result = useMigrate
            ? await migrateWorkerDb(
                workerUrl,
                authPepper,
                (line) => log(step, "info", line),
                cfAccessForSchema,
              )
            : await initWorkerDb(workerUrl, authPepper, (line) => log(step, "info", line));
          dbApplied = result.applied;
          dbAlreadyInitialized = useMigrate || result.alreadyInitialized;
          log(
            step,
            "info",
            useMigrate
              ? result.applied.length
                ? `D1 pending migrations applied (${result.applied.length})`
                : "D1 schema up to date — existing data kept"
              : `D1 schema initialized (${result.applied.length} migrations applied)`,
          );
        } catch (err) {
          log(step, "stderr", `Worker ${step} call failed: ${String(err)}`);
          throw err;
        }

        // 6. Owner passtoken (fresh install only — an existing owner keeps
        // their passtoken; re-issuing needs the separate reset-admin flow).
        let passtoken: string | null = null;
        if (!ownerAlreadyConfigured) {
          if (!authPepper) {
            throw new Error("AUTH_PEPPER is required to issue the owner passtoken");
          }
          const issued = await ownerSetupAdmin(workerUrl, authPepper);
          passtoken = issued.passtoken;
          log("setup-admin", "info", "Owner passtoken issued");
        } else {
          log(
            "setup-admin",
            "info",
            "Owner already configured on this Worker — sign in with your existing passtoken.",
          );
        }

        const workerVersion = (await fetchWorkerVersion(workerUrl)) ?? staged.version;

        send("done", {
          workerUrl,
          workerScriptName: DEFAULT_SCRIPT,
          r2Bucket: R2_BUCKET,
          accountId,
          d1LogsId: d1Ids[0] ?? "",
          d1MailId: d1Ids[1] ?? "",
          d1DbId: d1Ids[2] ?? "",
          dbAlreadyInitialized,
          dbApplied,
          workerVersion,
          passtoken,
          ownerAlreadyConfigured,
        });
      } catch (err) {
        send("error", { error: err instanceof Error ? err.message : String(err) });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  const response = new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
  // Persist a rotated refresh_token if Cloudflare issued one during the
  // session refresh above — otherwise the next request 401s.
  return applyRefreshedCookie(response, refreshedCookie);
}
