"use client";

import { Check, Copy, Loader2, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  desktopAutoInstallWorker,
  desktopCancelAutoInstall,
  desktopRefreshInstallToken,
  desktopRollbackInstall,
  desktopRegisterWorkerWithConsole,
  desktopSaveWorkerConnection,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  isInstallCancelledError,
  listenInstallLog,
  type DesktopErrorHelp,
  type InstallLogEvent,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { SetupBackLink, SetupScrollPage } from "@/console/components/setup/setup-page-chrome";

export function SetupProgressPanel() {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
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
    void runAutoInstall();
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

  async function runAutoInstall() {
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
    let token = installTokenFromCredentials();
    if (!token) {
      setError({
        title: "Connect Cloudflare first",
        detail:
          "Authorize Relaybase with Cloudflare before installing. There is no token to paste.",
        fix: "Go back and click Authorize with Cloudflare.",
      });
      busyRef.current = false;
      setBusy(false);
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
      const result = await desktopAutoInstallWorker(
        token,
        cfOAuthAccountId || undefined,
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
      setAutoDone({
        workerUrl: connect.workerUrl,
        adminToken: result.adminToken,
      });
      setMessage(`Connected to ${connect.workerUrl}`);
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
        fix: "Go back and click Authorize with Cloudflare.",
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
          <h1 className="text-2xl font-semibold tracking-tight">Installing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Creating resources and deploying the Worker in your Cloudflare
            account.
          </p>
        </div>

        {rollingBack ? (
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
                onClick={() => void runAutoInstall()}
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
                onClick={() => void runAutoInstall()}
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
              className="max-h-56 overflow-y-auto rounded bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-300"
            >
              {logs.map((entry, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  <span className="text-muted-foreground">
                    [{entry.step}:{entry.level}]
                  </span>{" "}
                  {entry.line}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!busy &&
        !stopping &&
        !rollingBack &&
        !rolledBack &&
        (autoDone || stopped || error) ? (
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
