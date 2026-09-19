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
  accountWorkersDevUrl,
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
  waitForWorkerReady,
} from "@/server/cloudflare/schema";
import { applyRefreshedCookie, sealSignupStaging } from "@/server/cloudflare/session";
import {
  SIGNUP_WORKER_SCRIPT,
  d1ModuleIdForDbName,
  installResourceAction,
  shouldRunSignupModule,
  type InstallModuleId,
} from "@/features/auth/lib/signup-install-modules";

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
  const cloudSignup = request.nextUrl.searchParams.get("cloudSignup") === "1";

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

      const emitModule = (
        id: InstallModuleId,
        status: "pending" | "running" | "done" | "error",
        cfResourceId?: string,
      ) => {
        send("module", { id, status, ...(cfResourceId ? { cfResourceId } : {}) });
      };

      const runR2 = shouldRunSignupModule("r2", decisions);
      const runWorkerSetup = shouldRunSignupModule("worker-setup", decisions);
      const workerAction = installResourceAction(decisions, "worker", SIGNUP_WORKER_SCRIPT);
      const skipWorkerUpload = workerAction === "skip" && decisions.length > 0;
      const pepperRequiredForCloudSignup = cloudSignup && mode === "install";

      try {
        const existingD1 = await listD1Databases(client).catch(() => []);

        // 1. R2
        if (runR2) {
          emitModule("r2", "running");
          log("r2", "info", "Checking that R2 is enabled on this Cloudflare account…");
          await assertR2Subscription(client);
          const r2Action = installResourceAction(decisions, "r2", R2_BUCKET);
          if (r2Action === "reinstall" && (await findR2Bucket(client, R2_BUCKET))) {
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
          emitModule("r2", "done");
        }

        // 2. D1 (one module per database)
        const d1Ids: string[] = [];
        let anyD1Reused = false;
        for (const [, dbName] of D1_DATABASES) {
          const moduleId = d1ModuleIdForDbName(dbName);
          const existing = existingD1.find(([n]) => n === dbName);
          const d1Action = installResourceAction(decisions, "d1", dbName);
          const runThisD1 = shouldRunSignupModule(moduleId!, decisions);

          if (!runThisD1) {
            if (existing) {
              anyD1Reused = true;
              d1Ids.push(existing[1]);
            } else {
              throw new Error(
                `${dbName} is missing on this account. Reinstall or create it on the previous step.`,
              );
            }
            continue;
          }

          emitModule(moduleId!, "running");
          if (d1Action === "reinstall" && existing) {
            const occ = await countD1UserRows(client, existing[1]);
            if (occ.occupied && !wipeConfirmationAllows(wipeConfirmation, [dbName])) {
              throw new Error(
                `${dbName} already has data. Type DELETE ME or the resource name to permanently delete it.`,
              );
            }
            log(moduleId!, "info", `Reinstall — deleting D1 ${dbName}…`);
            await deleteD1Database(client, existing[1]);
            log(moduleId!, "info", `Creating D1 ${dbName}…`);
            d1Ids.push(await createD1Database(client, dbName));
          } else if (existing) {
            anyD1Reused = true;
            d1Ids.push(existing[1]);
          } else {
            log(moduleId!, "info", `Creating D1 ${dbName}…`);
            d1Ids.push(await createD1Database(client, dbName));
          }
          const dbId = d1Ids[d1Ids.length - 1]!;
          log(moduleId!, "info", `D1 ${dbName} ready (id ${dbId})`);
          emitModule(moduleId!, "done", dbId);
        }

        let workerUrl = "";
        let stagedVersion = "unknown";
        let authPepper: string | undefined;
        let dbApplied: string[] = [];
        let dbAlreadyInitialized = false;

        const applyWorkerSecrets = async (logStep: string) => {
          const existingSecrets = await listWorkerSecrets(client, DEFAULT_SCRIPT).catch(
            (): string[] => [],
          );
          const alreadyHasPepper = existingSecrets.includes("AUTH_PEPPER");
          if (skipWorkerUpload && !pepperRequiredForCloudSignup) {
            log(logStep, "info", "AUTH_PEPPER unchanged (Worker skipped)");
          } else if (mode === "update" && alreadyHasPepper) {
            log(logStep, "info", "AUTH_PEPPER unchanged (Worker update)");
          } else {
            authPepper = generateAuthPepper();
            await putWorkerSecret(client, DEFAULT_SCRIPT, "AUTH_PEPPER", authPepper);
            log(
              logStep,
              "info",
              skipWorkerUpload && pepperRequiredForCloudSignup
                ? "AUTH_PEPPER rotated for cloud signup"
                : alreadyHasPepper
                  ? "AUTH_PEPPER rotated"
                  : "AUTH_PEPPER secret set",
            );
          }
          if (!skipWorkerUpload || pepperRequiredForCloudSignup) {
            await putWorkerSecret(client, DEFAULT_SCRIPT, "CF_ACCOUNT_ID", accountId);
            log(logStep, "info", "CF_ACCOUNT_ID secret set");
          }
        };

        if (runWorkerSetup) {
          emitModule("worker-setup", "running");

          if (skipWorkerUpload) {
            log(
              "worker-setup",
              "info",
              `Keeping Worker \`${DEFAULT_SCRIPT}\` as-is (Skip). Not uploading a new script.`,
            );
            workerUrl = await accountWorkersDevUrl(client, DEFAULT_SCRIPT);
            log("worker-setup", "info", `Using existing Worker at ${workerUrl}`);
          } else {
            log("worker-setup", "info", "Fetching Worker install manifest…");
            const manifest = await fetchInstallManifest();
            const staged = await stageInstallPackage(manifest, (line) =>
              log("worker-setup", "info", line),
            );
            stagedVersion = staged.version;

            log("worker-setup", "info", `Uploading Worker \`${DEFAULT_SCRIPT}\`…`);
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
              "worker-setup",
              "info",
              `Worker bindings: ${bindings.length ? bindings.map((b) => `${b.kind}:${b.name}`).join(", ") : "(none)"}`,
            );
            await putWorkerSchedules(client, DEFAULT_SCRIPT, "*/15 * * * *").catch((err) =>
              log("worker-setup", "stderr", `Could not set Worker cron: ${err}`),
            );
            workerUrl = await enableWorkersDev(client, DEFAULT_SCRIPT);
            log("worker-setup", "info", `Deployed at ${workerUrl}`);
          }

          await applyWorkerSecrets("worker-setup");

          if (!skipWorkerUpload) {
            await waitForWorkerReady(workerUrl, (line) => log("worker-setup", "info", line));

            const ownerAlreadyConfigured =
              mode === "update" ? true : await fetchOwnerConfigured(workerUrl);
            const useMigrate = mode === "update" || anyD1Reused || ownerAlreadyConfigured;
            const step = useMigrate ? "migrate-db" : "init-db";
            const cfAccessForSchema =
              (mode === "update" || skipWorkerUpload) && !authPepper
                ? session.accessToken
                : undefined;
            try {
              const result = useMigrate
                ? await migrateWorkerDb(
                    workerUrl,
                    authPepper,
                    (line) => log("worker-setup", "info", line),
                    cfAccessForSchema,
                  )
                : await initWorkerDb(
                    workerUrl,
                    authPepper,
                    (line) => log("worker-setup", "info", line),
                  );
              dbApplied = result.applied;
              dbAlreadyInitialized = useMigrate || result.alreadyInitialized;
              log(
                "worker-setup",
                "info",
                useMigrate
                  ? result.applied.length
                    ? `D1 pending migrations applied (${result.applied.length})`
                    : "D1 schema up to date — existing data kept"
                  : `D1 schema initialized (${result.applied.length} migrations applied)`,
              );
            } catch (err) {
              log("worker-setup", "stderr", `Worker ${step} call failed: ${String(err)}`);
              throw err;
            }

            if (mode === "update") {
              log("worker-setup", "info", "Worker update — your existing passtoken is unchanged.");
            } else if (!authPepper && ownerAlreadyConfigured) {
              log(
                "worker-setup",
                "info",
                "Deploy complete — owner passtoken will be issued during sign-up.",
              );
            } else if (!authPepper) {
              log(
                "worker-setup",
                "stderr",
                "AUTH_PEPPER was not available — the app cannot issue a passtoken.",
              );
            } else {
              log(
                "worker-setup",
                "info",
                ownerAlreadyConfigured
                  ? "Deploy complete — issuing a new owner passtoken during sign-up"
                  : "Deploy complete — owner passtoken will be issued during sign-up",
              );
            }
          } else {
            log(
              "worker-setup",
              "info",
              "Worker unchanged — skipping database initialization.",
            );
          }

          emitModule("worker-setup", "done");
        } else if (pepperRequiredForCloudSignup) {
          workerUrl = await accountWorkersDevUrl(client, DEFAULT_SCRIPT);
          await applyWorkerSecrets("_cloud-signup");
        } else {
          workerUrl = await accountWorkersDevUrl(client, DEFAULT_SCRIPT);
        }

        const ownerAlreadyConfigured =
          mode === "update" ? true : await fetchOwnerConfigured(workerUrl);

        const workerVersion = (await fetchWorkerVersion(workerUrl)) ?? stagedVersion;

        const pepperForClient =
          cloudSignup || mode === "update" ? "" : mode === "install" && authPepper ? authPepper : "";

        const cloudSignupReady = Boolean(cloudSignup && authPepper && mode === "install");
        const installToken = cloudSignupReady
          ? sealSignupStaging({
              workerUrl,
              accountId,
              authPepper: authPepper!,
            })
          : "";

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
          authPepper: pepperForClient,
          ownerAlreadyConfigured,
          cloudSignupReady,
          installToken,
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
