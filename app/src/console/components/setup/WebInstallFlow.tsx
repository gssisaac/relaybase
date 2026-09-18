"use client";

// Browser-native Cloudflare install flow — the web equivalent of
// WorkerInstallPanel + SetupProgressPanel's desktop (Tauri) auto-install.
// No OS keyring, no Touch ID, no Tauri invoke: OAuth tokens live server-side
// in a sealed cookie (see app/src/server/cloudflare/session.ts) and the
// install pipeline streams over SSE from /api/install/stream.
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SetupCloudflareAuthorizeCard } from "@/console/components/setup/SetupCloudflareAuthorizeCard";
import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import {
  explainCfOAuthError,
  oauthAuthorizationIncompleteHelp,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import {
  openWebCfOAuthPopup,
  webOAuthStartHrefForPath,
} from "@/lib/desktop/bridge/web-oauth-authorize";
import {
  consumeWebCfOAuthCompleteParam,
  fetchWebCfOAuthSessionPresent,
} from "@/lib/desktop/bridge/web-oauth-complete";
import {
  webOwnerLogin,
  webOwnerSetupAdmin,
} from "@/lib/desktop/bridge/web-owner-bridge";
import {
  canEnterMailboxAfterInstall,
  issuePasstokenWithRetry,
} from "@/console/components/setup/install-success-gate";
import { downloadPasstokenBackup } from "@/lib/desktop/worker-url/download-passtoken-backup";
import { rememberWorkerUrl } from "@/lib/desktop/worker-url/recent-worker-urls";
import { saveUserConnection } from "@/lib/desktop/user-data";
import { useOptionalDesktop } from "@/lib/desktop/shell";

type InstallLogEvent = { step: string; level: "info" | "stderr"; line: string };

type InstallStreamDone = {
  workerUrl: string;
  workerScriptName: string;
  workerVersion: string;
  authPepper?: string;
  ownerAlreadyConfigured?: boolean;
  accountId?: string;
};

/** Web install / update — same Relaybase → Cloudflare authorize card as desktop. */
export function WebAuthorizeCard({
  afterAuthPath = "/setup/install",
  buttonLabel = "Authorize and install on Cloudflare",
  runInstallOnSamePage = true,
}: {
  /** OAuth return target (web-complete `next`). Install stays on this page when `runInstallOnSamePage`. */
  afterAuthPath?: string;
  buttonLabel?: string;
  /** Run SSE install here instead of navigating to `/setup/progress` (avoids web redirect loops). */
  runInstallOnSamePage?: boolean;
}) {
  const router = useRouter();
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<DesktopErrorHelp | null>(null);
  const [installing, setInstalling] = useState(false);
  // Whether a valid CF OAuth session cookie is already present.
  // "checking" → still probing /api/oauth/session on mount.
  // "present"  → cookie exists; show "Continue" instead of forcing re-auth.
  // "absent"  → no cookie; show the normal authorize card.
  // Desktop runtime skips the probe entirely (OAuth lives in the OS
  // keyring, not a cookie) so we initialise straight to "absent".
  const [sessionCheck, setSessionCheck] = useState<
    "checking" | "present" | "absent"
  >(() => (isDesktopRuntime() ? "absent" : "checking"));

  // On mount, check whether an OAuth session cookie is already present.
  // Without this, the card always shows the "Authorize" button — so a
  // user who just authorized, navigated to /setup/progress, then hit Back
  // to /setup/install and re-entered would be asked to authorize again
  // even though their sealed cookie is still valid. That was the
  // "back → re-enter → asked to auth again" loop.
  useEffect(() => {
    if (sessionCheck !== "checking") return;
    let active = true;
    void (async () => {
      const present = await fetchWebCfOAuthSessionPresent();
      if (!active) return;
      setSessionCheck(present ? "present" : "absent");
    })();
    return () => {
      active = false;
    };
  }, [sessionCheck]);

  useEffect(() => {
    if (!runInstallOnSamePage || isDesktopRuntime()) return;
    if (!consumeWebCfOAuthCompleteParam()) return;
    setSessionCheck("present");
    setInstalling(true);
  }, [runInstallOnSamePage]);

  function beginInstall() {
    if (runInstallOnSamePage) {
      setInstalling(true);
      return;
    }
    router.push(afterAuthPath);
  }

  function finishOAuthSuccess() {
    setOauthBusy(false);
    setSessionCheck("present");
    if (runInstallOnSamePage) {
      setInstalling(true);
      return;
    }
    router.push(afterAuthPath);
  }

  function startAuthorize() {
    if (isDesktopRuntime()) return;
    setOauthError(null);
    setOauthBusy(true);
    const authorizeHref = webOAuthStartHrefForPath(afterAuthPath);
    openWebCfOAuthPopup(authorizeHref, {
      onComplete: () => {
        finishOAuthSuccess();
      },
      onError: (message) => {
        setOauthBusy(false);
        setOauthError(explainCfOAuthError(message));
      },
    });
  }

  function handleCancelWait() {
    setOauthBusy(false);
    setOauthError(oauthAuthorizationIncompleteHelp("cancelled"));
  }

  // While probing for an existing session, show a neutral loading state
  // so the user doesn't see a flash of the authorize button that would
  // immediately disappear.
  if (installing && runInstallOnSamePage) {
    return <WebInstallProgress />;
  }

  if (sessionCheck === "checking") {
    return (
      <SetupCloudflareAuthorizeCard
        oauthBusy={true}
        oauthError={null}
        onAuthorize={() => {}}
        onCancelWait={() => {}}
        authorizeLabel={buttonLabel}
        diagramWaiting={true}
        waitingSubtitle="Checking your Cloudflare authorization…"
        showCancelWait={false}
      />
    );
  }

  // Already authorized — don't force the user through the authorize
  // popup again. Offer a direct "Continue" plus a secondary "Authorize
  // again" path for the rare case they need to switch Cloudflare accounts.
  if (sessionCheck === "present" && !oauthBusy) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-2">
        <div className="flex w-[300px] max-w-full flex-col items-center gap-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Cloudflare authorization is active
          </p>
          <p className="text-center text-xs text-muted-foreground">
            You already authorized Relaybase. Continue to the install, or authorize again to
            switch Cloudflare accounts.
          </p>
          <Button type="button" className="w-full" onClick={beginInstall}>
            Continue to install
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => {
              setSessionCheck("absent");
              void startAuthorize();
            }}
          >
            Authorize again
          </button>
        </div>
      </div>
    );
  }

  return (
    <SetupCloudflareAuthorizeCard
      oauthBusy={oauthBusy}
      oauthError={oauthError}
      onAuthorize={startAuthorize}
      onCancelWait={handleCancelWait}
      authorizeLabel={buttonLabel}
      diagramWaiting={oauthBusy}
    />
  );
}

/** Runs after the Cloudflare OAuth redirect lands the browser on /setup/progress. */
export function WebInstallProgress() {
  const router = useRouter();
  const desktop = useOptionalDesktop();
  const [logs, setLogs] = useState<InstallLogEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoDone, setAutoDone] = useState<{
    workerUrl: string;
    revealedPasstoken: string;
  } | null>(null);
  const [installPepper, setInstallPepper] = useState<string | null>(null);
  const [issuingPasstoken, setIssuingPasstoken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [tokenDownloaded, setTokenDownloaded] = useState(false);
  const [leavingToMailbox, setLeavingToMailbox] = useState(false);
  const [passtokenError, setPasstokenError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let source: EventSource | null = null;
    let cancelled = false;

    void (async () => {
      const oauthOk = await fetchWebCfOAuthSessionPresent();
      if (cancelled) return;
      if (!oauthOk) {
        setError(
          "Cloudflare authorization is missing or expired. Go back and authorize again.",
        );
        return;
      }

      source = new EventSource("/api/install/stream");
      source.addEventListener("log", (e) => {
        setLogs((prev) => [...prev, JSON.parse((e as MessageEvent).data)]);
      });
      source.addEventListener("done", (e) => {
        const payload = JSON.parse((e as MessageEvent).data) as InstallStreamDone;
        source?.close();
        void (async () => {
          try {
            await saveUserConnection({
              workerUrl: payload.workerUrl,
              accountId: payload.accountId,
              workerScriptName: payload.workerScriptName,
              workerVersion: payload.workerVersion,
            });
            await desktop?.refresh?.();
          } catch {
            /* best-effort */
          }
          const workerUrl = payload.workerUrl.replace(/\/$/, "");
          const pepper = payload.authPepper?.trim() ?? "";
          setInstallPepper(pepper || null);
          setAutoDone({ workerUrl, revealedPasstoken: "" });
          await finishWebInstall(workerUrl, pepper);
        })();
      });
      source.addEventListener("error", (e) => {
        const msg = (e as MessageEvent).data;
        setError(
          msg
            ? (JSON.parse(msg)?.error ?? "Install failed")
            : "Connection to the install stream was lost. If you just authorized, try Continue to install again.",
        );
        source?.close();
      });
    })();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [desktop]);

  useEffect(() => {
    logEndRef.current?.scrollTo({ top: logEndRef.current.scrollHeight });
  }, [logs]);

  async function finishWebInstall(workerUrl: string, pepper: string) {
    if (!pepper) {
      setPasstokenError(
        "Install finished but AUTH_PEPPER was not available to create the owner login. Try install again, or use I forgot my passtoken.",
      );
      return;
    }
    setIssuingPasstoken(true);
    setPasstokenError(null);
    try {
      const issued = await issuePasstokenWithRetry(webOwnerSetupAdmin, {
        workerUrl,
        pepper,
      });
      setInstallPepper(null);
      setTokenSaved(false);
      setTokenDownloaded(false);
      setCopiedToken(false);
      setAutoDone({ workerUrl, revealedPasstoken: issued.passtoken });
    } catch (err) {
      setInstallPepper(pepper);
      setAutoDone({ workerUrl, revealedPasstoken: "" });
      setPasstokenError(err instanceof Error ? err.message : "Could not issue a passtoken");
    } finally {
      setIssuingPasstoken(false);
    }
  }

  async function issuePasstokenManually() {
    if (!autoDone || issuingPasstoken) return;
    const pepper = installPepper?.trim() ?? "";
    if (!pepper) return;
    await finishWebInstall(autoDone.workerUrl, pepper);
  }

  async function copyAutoToken() {
    if (!autoDone?.revealedPasstoken) return;
    await navigator.clipboard.writeText(autoDone.revealedPasstoken);
    setCopiedToken(true);
    setTokenSaved(true);
  }

  async function downloadAutoToken() {
    if (!autoDone?.revealedPasstoken) return;
    await downloadPasstokenBackup(autoDone.revealedPasstoken);
    setTokenDownloaded(true);
    setTokenSaved(true);
  }

  async function goToMailbox() {
    if (!autoDone) return;
    const passtoken = autoDone.revealedPasstoken.trim();
    if (
      !canEnterMailboxAfterInstall({
        revealedPasstoken: passtoken,
        tokenSaved,
      })
    ) {
      return;
    }
    setLeavingToMailbox(true);
    try {
      const workerUrl = autoDone.workerUrl.replace(/\/$/, "");
      await webOwnerLogin({ workerUrl, passtoken });
      rememberWorkerUrl(workerUrl);
      router.replace("/email/inbox");
    } catch (err) {
      setLeavingToMailbox(false);
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-destructive">Install failed</p>
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{error}</p>
        <Button type="button" className="w-full" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  if (autoDone) {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
        <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
          🎉 Installed and connected!
        </p>
        <p className="text-xs text-muted-foreground">
          Worker URL: <span className="font-mono">{autoDone.workerUrl}</span>
        </p>
        {passtokenError ? (
          <p className="text-xs text-destructive whitespace-pre-wrap">{passtokenError}</p>
        ) : null}
        <div className="space-y-2">
          {issuingPasstoken ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Issuing your owner passtoken…
            </p>
          ) : autoDone.revealedPasstoken ? (
            <>
              <p className="text-xs font-medium">Save your passtoken</p>
              <p className="text-xs text-muted-foreground">
                Shown once. Copy or download a backup before opening the mailbox.
              </p>
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <code className="block break-all font-mono text-[11px]">
                  {autoDone.revealedPasstoken}
                </code>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant={copiedToken || tokenSaved ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => void copyAutoToken()}
                >
                  {copiedToken ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy passtoken
                </Button>
                <Button
                  type="button"
                  variant={tokenDownloaded ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => void downloadAutoToken()}
                >
                  {tokenDownloaded ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Download .txt
                </Button>
              </div>
              {tokenSaved ? (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Passtoken saved. You can continue.
                </p>
              ) : (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Copy or download before Go to Mailbox.
                </p>
              )}
            </>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void issuePasstokenManually();
              }}
            >
              <p className="text-xs font-medium">Create the owner login</p>
              <p className="text-xs text-muted-foreground">
                We issue a passtoken once — copy or download it before opening the mailbox.
              </p>
              <Button
                type="submit"
                className="w-full"
                disabled={issuingPasstoken || !installPepper}
              >
                {issuingPasstoken ? <Loader2 className="size-4 animate-spin" /> : null}
                Issue passtoken
              </Button>
            </form>
          )}
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={
            !canEnterMailboxAfterInstall({
              revealedPasstoken: autoDone.revealedPasstoken,
              tokenSaved,
              leavingToMailbox,
            })
          }
          onClick={() => void goToMailbox()}
        >
          {leavingToMailbox ? "Opening…" : "Go to Mailbox"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Creating resources and deploying the Worker in your Cloudflare account…
      </div>
      {logs.length > 0 ? (
        <div
          ref={logEndRef}
          className="max-h-72 select-text cursor-text overflow-y-auto rounded bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-300"
        >
          {logs.map((entry, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              <span className="text-muted-foreground">
                [{entry.step}:{entry.level}]
              </span>{" "}
              {entry.line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type WorkerUpdateDone = {
  workerUrl: string;
  workerScriptName: string;
  workerVersion: string;
  accountId?: string;
};

/** Web Worker script update — same SSE pipeline with `mode=update` (keeps AUTH_PEPPER). */
export function WebWorkerUpdateProgress({ onDone }: { onDone?: () => void }) {
  const desktop = useOptionalDesktop();
  const [logs, setLogs] = useState<InstallLogEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<WorkerUpdateDone | null>(null);
  const startedRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const source = new EventSource("/api/install/stream?mode=update");
    source.addEventListener("log", (e) => {
      setLogs((prev) => [...prev, JSON.parse((e as MessageEvent).data)]);
    });
    source.addEventListener("done", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as WorkerUpdateDone;
      setDone(payload);
      source.close();
      void (async () => {
        try {
          await saveUserConnection({
            workerUrl: payload.workerUrl,
            accountId: payload.accountId,
            workerScriptName: payload.workerScriptName,
            workerVersion: payload.workerVersion,
          });
          await desktop?.refresh?.();
        } catch {
          /* best-effort */
        }
        onDone?.();
      })();
    });
    source.addEventListener("error", (e) => {
      const msg = (e as MessageEvent).data;
      setError(
        msg
          ? (JSON.parse(msg)?.error ?? "Update failed")
          : "Connection to the update stream was lost.",
      );
      source.close();
    });
    return () => source.close();
  }, [desktop, onDone]);

  useEffect(() => {
    logEndRef.current?.scrollTo({ top: logEndRef.current.scrollHeight });
  }, [logs]);

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-destructive">Worker update failed</p>
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{error}</p>
        <Button type="button" className="w-full" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          Worker updated
          {done.workerVersion ? ` to v${done.workerVersion}` : ""}.
        </p>
        <p className="text-xs text-muted-foreground">
          Worker URL: <span className="font-mono">{done.workerUrl}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Uploading the latest Worker script — R2 and D1 are unchanged…
      </div>
      {logs.length > 0 ? (
        <div
          ref={logEndRef}
          className="max-h-72 select-text cursor-text overflow-y-auto rounded bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-300"
        >
          {logs.map((entry, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              <span className="text-muted-foreground">
                [{entry.step}:{entry.level}]
              </span>{" "}
              {entry.line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
