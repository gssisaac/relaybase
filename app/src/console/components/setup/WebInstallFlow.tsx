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
import { fetchWebCfOAuthSessionPresent } from "@/lib/desktop/bridge/web-oauth-complete";
import { webOwnerLogin } from "@/lib/desktop/bridge/web-owner-bridge";
import { downloadPasstokenBackup } from "@/lib/desktop/worker-url/download-passtoken-backup";
import { rememberWorkerUrl } from "@/lib/desktop/worker-url/recent-worker-urls";
import { saveUserConnection } from "@/lib/desktop/user-data";
import { useOptionalDesktop } from "@/lib/desktop/shell";

type InstallLogEvent = { step: string; level: "info" | "stderr"; line: string };

type InstallDone = {
  workerUrl: string;
  workerScriptName: string;
  workerVersion: string;
  passtoken: string | null;
  ownerAlreadyConfigured: boolean;
};

/** Web install / update — same Relaybase → Cloudflare authorize card as desktop. */
export function WebAuthorizeCard({
  afterAuthPath = "/setup/progress",
  buttonLabel = "Authorize and install on Cloudflare",
}: {
  /** In-app path to open after Cloudflare OAuth succeeds (install / update progress). */
  afterAuthPath?: string;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<DesktopErrorHelp | null>(null);
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

  function startAuthorize() {
    if (isDesktopRuntime()) return;
    setOauthError(null);
    setOauthBusy(true);
    const authorizeHref = webOAuthStartHrefForPath(afterAuthPath);
    openWebCfOAuthPopup(authorizeHref, {
      onComplete: () => {
        setOauthBusy(false);
        router.push(afterAuthPath);
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
          <Button
            type="button"
            className="w-full"
            onClick={() => router.push(afterAuthPath)}
          >
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
  const [done, setDone] = useState<InstallDone | null>(null);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const startedRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const source = new EventSource("/api/install/stream");
    source.addEventListener("log", (e) => {
      setLogs((prev) => [...prev, JSON.parse((e as MessageEvent).data)]);
    });
    source.addEventListener("done", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as InstallDone & {
        accountId?: string;
        workerScriptName?: string;
        workerVersion?: string;
      };
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
          /* best-effort — user can still sign in manually */
        }
      })();
    });
    source.addEventListener("error", (e) => {
      const msg = (e as MessageEvent).data;
      setError(msg ? (JSON.parse(msg)?.error ?? "Install failed") : "Connection to the install stream was lost.");
      source.close();
    });
    return () => source.close();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollTo({ top: logEndRef.current.scrollHeight });
  }, [logs]);

  async function copyToken() {
    if (!done?.passtoken) return;
    await navigator.clipboard.writeText(done.passtoken);
    setCopied(true);
    setTokenSaved(true);
  }

  async function downloadToken() {
    if (!done?.passtoken) return;
    await downloadPasstokenBackup(done.passtoken);
    setDownloaded(true);
    setTokenSaved(true);
  }

  async function goToMailbox() {
    if (!done) return;
    setContinuing(true);
    try {
      const workerUrl = done.workerUrl.replace(/\/$/, "");
      if (done.passtoken) {
        // Bootstrap an owner session directly against the deployed Worker —
        // same webOwnerLogin() the Account Login screen's owner tab uses, so
        // the rest of the app (workerFetch's Bearer path, WebOwnerSession)
        // picks it up. Access stays in memory; refresh is mirrored to tab
        // sessionStorage so a reload on /dashboard restores the session.
        await webOwnerLogin({ workerUrl, passtoken: done.passtoken });
        rememberWorkerUrl(workerUrl);
        router.push("/dashboard");
      } else {
        // An owner was already configured on this Worker — nothing to log
        // in with here. Send them to sign in with their existing passtoken.
        router.push(`/worker/login?workerUrl=${encodeURIComponent(workerUrl)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setContinuing(false);
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

  if (done) {
    const canContinue = !done.passtoken || tokenSaved;
    return (
      <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
        <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
          🎉 Installed and connected!
        </p>
        <p className="text-xs text-muted-foreground">
          Worker URL: <span className="font-mono">{done.workerUrl}</span>
        </p>
        {done.passtoken ? (
          <div className="space-y-2">
            <p className="text-xs font-medium">Save your passtoken</p>
            <p className="text-xs text-muted-foreground">
              Shown once — copy or download a backup before continuing. There is no other way to
              recover it.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <code className="block break-all font-mono text-[11px]">{done.passtoken}</code>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant={copied || tokenSaved ? "default" : "outline"}
                className="flex-1"
                onClick={() => void copyToken()}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy passtoken
              </Button>
              <Button
                type="button"
                variant={downloaded ? "default" : "outline"}
                className="flex-1"
                onClick={() => void downloadToken()}
              >
                {downloaded ? <Check className="size-3.5" /> : <Download className="size-3.5" />}
                Download .txt
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            An owner is already configured on this Worker — sign in with your existing passtoken.
          </p>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={!canContinue || continuing}
          onClick={() => void goToMailbox()}
        >
          {continuing ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Go to dashboard
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
