"use client";

import { Check, Copy, ExternalLink, Loader2, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cloudflareWorkersDashboardUrl,
  desktopAutoInstallWorker,
  desktopCancelAutoInstall,
  desktopOpenExternal,
  desktopInitWorkerDb,
  desktopProbeInstall,
  desktopRefreshInstallToken,
  desktopRollbackInstall,
  desktopRegisterWorkerWithConsole,
  desktopSaveWorkerConnection,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  isInstallCancelledError,
  listenInstallLog,
  stripAnsi,
  type DesktopErrorHelp,
  type InstallDecision,
  type InstallLogEvent,
  type InstallResourceProbe,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { CloudflareModuleIcon } from "@/console/components/CloudflareModuleIcon";
import { SetupBackLink, SetupScrollPage } from "@/console/components/setup/setup-page-chrome";

function resourceKindLabel(kind: string): "Worker" | "R2" | "D1" {
  if (kind === "r2") return "R2";
  if (kind === "d1") return "D1";
  return "Worker";
}

export function SetupProgressPanel() {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
  const [probing, setProbing] = useState(false);
  const [existing, setExisting] = useState<InstallResourceProbe[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "skip" | "reinstall">>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rolledBack, setRolledBack] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<InstallLogEvent[]>([]);
  const [autoDone, setAutoDone] = useState<{
    workerUrl: string;
    adminToken: string;
  } | null>(null);
  const [dbAlreadyInit, setDbAlreadyInit] = useState<{
    workerUrl: string;
    adminToken: string;
  } | null>(null);
  const [clearingDb, setClearingDb] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const installStartedRef = useRef(false);
  const busyRef = useRef(false);

  const cfOAuthConnected = Boolean(
    credentials?.cfOauthRefreshToken?.trim() ||
      credentials?.cfOauthAccessToken?.trim(),
  );
  const cfOAuthAccountId =
    credentials?.cfOauthAccountId?.trim() ||
    credentials?.accountId?.trim() ||
    "";

  function installTokenFromCredentials() {
    return (
      credentials?.cfOauthAccessToken?.trim() ||
      credentials?.installToken?.trim() ||
      ""
    );
  }

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (!copiedToken) return;
    const t = window.setTimeout(() => setCopiedToken(false), 2000);
    return () => window.clearTimeout(t);
  }, [copiedToken]);

  useEffect(() => {
    if (!credentials) return;
    if (!cfOAuthConnected) {
      router.replace("/setup/install");
      return;
    }
    if (installStartedRef.current) return;
    installStartedRef.current = true;
    void startFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, cfOAuthConnected]);

  async function stopInstall() {
    if (!busyRef.current || stopping) return;
    setStopping(true);
    try {
      await desktopCancelAutoInstall();
    } catch {
      /* install promise rejects when cancel lands */
    }
  }

  function decisionKey(r: Pick<InstallResourceProbe, "kind" | "name">) {
    return `${r.kind}:${r.name}`;
  }

  async function resolvedToken() {
    let token = installTokenFromCredentials();
    try {
      const refreshed = await desktopRefreshInstallToken();
      token =
        refreshed.cfOauthAccessToken?.trim() ||
        refreshed.installToken?.trim() ||
        token;
    } catch (err) {
      const raw = String(err ?? "");
      if (
        raw.toLowerCase().includes("cloudflare_auth_expired") ||
        raw.toLowerCase().includes("invalid access token")
      ) {
        throw err;
      }
      /* use the current access token if refresh is unavailable */
    }
    return token;
  }

  async function startFlow() {
    setProbing(true);
    setError(null);
    setStopped(false);
    setRolledBack(false);
    setAutoDone(null);
    setExisting([]);
    try {
      const token = await resolvedToken();
      if (!token) {
        setError({
          title: "Connect Cloudflare first",
          detail:
            "Authorize Relaybase with Cloudflare before installing. There is no token to paste.",
          fix: "Go back and click Authorize and install on Cloudflare.",
        });
        return;
      }
      const probe = await desktopProbeInstall(
        token,
        cfOAuthAccountId || undefined,
      );
      const found = probe.resources.filter((r) => r.present);
      if (found.length === 0) {
        setProbing(false);
        await runAutoInstall([]);
        return;
      }
      setExisting(found);
      setDecisions(
        Object.fromEntries(found.map((r) => [decisionKey(r), "skip" as const])),
      );
    } catch (err) {
      setError(explainDesktopError(err, "Could not check existing resources"));
    } finally {
      setProbing(false);
    }
  }

  function setAllDecisions(action: "skip" | "reinstall") {
    setDecisions(
      Object.fromEntries(existing.map((r) => [decisionKey(r), action])),
    );
  }

  async function runAutoInstall(plan?: InstallDecision[]) {
    busyRef.current = true;
    setBusy(true);
    setStopping(false);
    setStopped(false);
    setRollingBack(false);
    setRolledBack(false);
    setError(null);
    setMessage(null);
    setLogs([]);
    setAutoDone(null);
    const chosen =
      plan ??
      existing.map((r) => ({
        kind: r.kind,
        name: r.name,
        action: decisions[decisionKey(r)] ?? "skip",
      }));
    let token = await resolvedToken();
    if (!token) {
      setError({
        title: "Connect Cloudflare first",
        detail:
          "Authorize Relaybase with Cloudflare before installing. There is no token to paste.",
        fix: "Go back and click Authorize and install on Cloudflare.",
      });
      busyRef.current = false;
      setBusy(false);
      return;
    }
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenInstallLog((event) => {
        setLogs((prev) => [...prev, event]);
      });
      const result = await desktopAutoInstallWorker(
        token,
        cfOAuthAccountId || undefined,
        undefined,
        chosen,
      );
      const connect = await desktopVerifyWorkerConnection(
        result.workerUrl,
        result.adminToken,
      );
      await desktopSaveWorkerConnection({
        workerUrl: connect.workerUrl,
        adminToken: result.adminToken,
        workerScriptName: connect.workerScriptName,
      });
      void desktopRegisterWorkerWithConsole(connect.workerUrl).catch(() => {
        /* best-effort */
      });
      await refresh();
      if (result.dbAlreadyInitialized) {
        setDbAlreadyInit({
          workerUrl: connect.workerUrl,
          adminToken: result.adminToken,
        });
      } else {
        setAutoDone({
          workerUrl: connect.workerUrl,
          adminToken: result.adminToken,
        });
        setMessage(`Connected to ${connect.workerUrl}`);
      }
    } catch (err) {
      if (isInstallCancelledError(err)) {
        setStopped(true);
        setError(null);
      } else {
        setError(explainDesktopError(err, "Auto-install failed"));
      }
    } finally {
      if (unlisten) unlisten();
      busyRef.current = false;
      setBusy(false);
      setStopping(false);
    }
  }

  async function runRollback() {
    if (rollingBack || busyRef.current) return;
    setRollingBack(true);
    setError(null);
    let token = installTokenFromCredentials();
    if (!token) {
      setError({
        title: "Connect Cloudflare first",
        detail: "Authorize Relaybase with Cloudflare before rolling back.",
        fix: "Go back and click Authorize and install on Cloudflare.",
      });
      setRollingBack(false);
      return;
    }
    let unlisten: (() => void) | null = null;
    try {
      try {
        const refreshed = await desktopRefreshInstallToken();
        token =
          refreshed.cfOauthAccessToken?.trim() ||
          refreshed.installToken?.trim() ||
          token;
      } catch {
        /* use the current access token if refresh is unavailable */
      }
      unlisten = await listenInstallLog((event) => {
        setLogs((prev) => [...prev, event]);
      });
      await desktopRollbackInstall(token, cfOAuthAccountId || undefined);
      setRolledBack(true);
      setAutoDone(null);
      setStopped(false);
      setMessage(null);
      await refresh();
    } catch (err) {
      setError(explainDesktopError(err, "Rollback failed"));
    } finally {
      if (unlisten) unlisten();
      setRollingBack(false);
    }
  }

  async function copyAutoToken() {
    if (!autoDone?.adminToken) return;
    await navigator.clipboard.writeText(autoDone.adminToken);
    setCopiedToken(true);
  }

  async function confirmClearDb(clear: boolean) {
    if (!dbAlreadyInit || clearingDb) return;
    if (clear) {
      setClearingDb(true);
      try {
        await desktopInitWorkerDb(
          dbAlreadyInit.workerUrl,
          dbAlreadyInit.adminToken,
          true,
        );
      } catch (err) {
        setError(explainDesktopError(err, "Could not clear database"));
        setClearingDb(false);
        return;
      }
      setClearingDb(false);
    }
    setAutoDone({
      workerUrl: dbAlreadyInit.workerUrl,
      adminToken: dbAlreadyInit.adminToken,
    });
    setMessage(
      clear
        ? "Database cleared and reinitialized"
        : `Connected to ${dbAlreadyInit.workerUrl}`,
    );
    setDbAlreadyInit(null);
  }

  return (
    <SetupScrollPage>
      <div className="flex justify-end">
        <SetupBackLink
          onClick={async () => {
            if (busyRef.current) {
              await desktopCancelAutoInstall();
            }
          }}
        />
      </div>
      <div className="mt-3 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {existing.length > 0 && !busy && !autoDone
              ? "Existing resources"
              : probing
                ? "Checking"
                : "Installing"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {existing.length > 0 && !busy && !autoDone
              ? "Some Relaybase resources already exist in this Cloudflare account. Choose Skip or Reinstall for each, then continue."
              : probing
                ? "Looking for an existing Worker, R2 bucket, and D1 databases before creating anything."
                : "Creating resources and deploying the Worker in your Cloudflare account."}
          </p>
        </div>

        {probing ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking for existing Cloudflare resources…
          </div>
        ) : existing.length > 0 &&
          !busy &&
          !autoDone &&
          !stopped &&
          !rollingBack &&
          !rolledBack ? (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">
                Existing resources found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                These already exist in your Cloudflare account. Skip keeps
                them. Reinstall deletes them and creates new ones.
              </p>
            </div>
            <ul className="space-y-3">
              {existing.map((r) => {
                const key = decisionKey(r);
                const action = decisions[key] ?? "skip";
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CloudflareModuleIcon
                        kind={resourceKindLabel(r.kind)}
                        className="size-5 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-mono text-xs">
                          <span className="text-muted-foreground">
                            {resourceKindLabel(r.kind)}
                          </span>{" "}
                          <span className="font-medium">{r.name}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={action === "skip" ? "default" : "outline"}
                        onClick={() =>
                          setDecisions((prev) => ({ ...prev, [key]: "skip" }))
                        }
                      >
                        Skip
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          action === "reinstall" ? "default" : "outline"
                        }
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [key]: "reinstall",
                          }))
                        }
                      >
                        Reinstall
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAllDecisions("skip")}
              >
                Skip all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAllDecisions("reinstall")}
              >
                Reinstall all
              </Button>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                const plan = existing.map((r) => ({
                  kind: r.kind,
                  name: r.name,
                  action: decisions[decisionKey(r)] ?? "skip",
                }));
                setExisting([]);
                void runAutoInstall(plan);
              }}
            >
              Continue install
            </Button>
          </div>
        ) : rollingBack ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Rolling back — deleting Worker, D1, and R2…
          </div>
        ) : rolledBack ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Rolled back</p>
            <p className="text-xs text-muted-foreground">
              The Worker, D1 databases, and R2 bucket from this install were
              removed from your Cloudflare account.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                onClick={() => void startFlow()}
              >
                Try again
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/setup")}
              >
                Back to start
              </Button>
            </div>
          </div>
        ) : dbAlreadyInit ? (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Database already initialized
            </p>
            <p className="text-xs text-muted-foreground">
              The D1 databases already have tables and data from a previous
              install. Migrations were applied (if any were pending). Do you
              want to keep the existing data, or clear everything and start
              fresh?
            </p>
            {clearingDb ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Clearing database…
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => void confirmClearDb(true)}
                >
                  Clear and reinitialize
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => void confirmClearDb(false)}
                >
                  Keep existing data
                </Button>
              </div>
            )}
          </div>
        ) : autoDone ? (
          <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Installed and connected
            </p>
            <p className="text-xs text-muted-foreground">
              Worker URL:{" "}
              <span className="font-mono">{autoDone.workerUrl}</span>
            </p>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Save this admin token — it&apos;s the only way to recover your
                Worker if you lose this Mac. Relaybase cannot recover it for
                you.
              </p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[11px]">
                  {autoDone.adminToken}
                </code>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Copy admin token"
                  onClick={() => void copyAutoToken()}
                >
                  {copiedToken ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                const url = cloudflareWorkersDashboardUrl(cfOAuthAccountId);
                void desktopOpenExternal(url);
              }}
            >
              <ExternalLink className="size-3.5" />
              Open Cloudflare dashboard
            </Button>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.assign("/");
                }
              }}
            >
              Continue to dashboard
            </Button>
          </div>
        ) : stopped ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Installation stopped</p>
            <p className="text-xs text-muted-foreground">
              Install was stopped. Resources already created in Cloudflare are
              still there — use Rollback below to delete them.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                onClick={() => void startFlow()}
              >
                Try again
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/setup")}
              >
                Back to start
              </Button>
            </div>
          </div>
        ) : (
          <>
            {busy ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {stopping
                    ? "Stopping and rolling back…"
                    : "Installing…"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={stopping}
                  onClick={() => void stopInstall()}
                >
                  <Square className="size-3 fill-current" />
                  Stop
                </Button>
              </div>
            ) : null}
            {message ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {message}
              </p>
            ) : null}
          </>
        )}

        {error && !rollingBack ? <DesktopErrorBanner error={error} /> : null}

        {logs.length > 0 || rollingBack ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-xs font-medium">Install log</p>
            <div
              ref={logEndRef}
              className="max-h-56 select-text cursor-text overflow-y-auto rounded bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-300"
            >
              {logs.map((entry, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  <span className="text-muted-foreground">
                    [{entry.step}:{entry.level}]
                  </span>{" "}
                  {stripAnsi(entry.line)}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error &&
        !busy &&
        !autoDone &&
        !stopped &&
        !rollingBack &&
        !rolledBack &&
        existing.length === 0 ? (
          error.title.toLowerCase().includes("authorization expired") ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push("/setup/install")}
            >
              Authorize again
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={() => void startFlow()}
            >
              Try again
            </Button>
          )
        ) : null}

        {!busy &&
        !stopping &&
        !rollingBack &&
        !rolledBack &&
        (autoDone || stopped || (error && logs.length > 0)) ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void runRollback()}
          >
            Rollback
          </Button>
        ) : null}
      </div>
    </SetupScrollPage>
  );
}
