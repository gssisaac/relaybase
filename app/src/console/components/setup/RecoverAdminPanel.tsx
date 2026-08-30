"use client";

import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/attachments/download";
import {
  CF_OAUTH_AUTHORIZE_WAIT_MS,
  desktopOpenExternal,
  desktopRegisterWorkerWithConsole,
  desktopSaveDownloadFile,
  desktopStartCfOAuth,
  explainCfOAuthError,
  explainPasstokenResetError,
  isDesktopRuntime,
  listenCfOAuthResult,
  oauthAuthorizationIncompleteHelp,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/shell";
import { useDesktop } from "@/lib/desktop/shell";
import { useAppSession } from "@/lib/desktop/app-session";
import { resolveWorkerUrl } from "@/lib/desktop/app-session/resolve-worker-url";
import { SetupCloudflareAuthorizeCard } from "@/console/components/setup/SetupCloudflareAuthorizeCard";
import { SetupCenteredPage } from "@/console/components/setup/setup-page-chrome";

/**
 * Forgot-passtoken recovery. Authorizes Cloudflare, then calls
 * `/console/reset-admin` with the in-memory OAuth access token. The Worker
 * re-issues the owner passtoken once.
 */
export function RecoverAdminPanel() {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
  const store = useAppSession();
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<DesktopErrorHelp | null>(null);
  const [issueError, setIssueError] = useState<DesktopErrorHelp | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [tokenDownloaded, setTokenDownloaded] = useState(false);
  const oauthWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOauthWaitTimer = useCallback(() => {
    if (oauthWaitTimerRef.current) {
      clearTimeout(oauthWaitTimerRef.current);
      oauthWaitTimerRef.current = null;
    }
  }, []);

  const finishOauthWait = useCallback(
    (opts?: { error?: DesktopErrorHelp | null }) => {
      clearOauthWaitTimer();
      setOauthBusy(false);
      if (opts && "error" in opts) {
        setOauthError(opts.error ?? null);
      }
    },
    [clearOauthWaitTimer],
  );

  const startOauthWaitTimer = useCallback(() => {
    clearOauthWaitTimer();
    oauthWaitTimerRef.current = setTimeout(() => {
      oauthWaitTimerRef.current = null;
      setOauthBusy(false);
      setOauthError(oauthAuthorizationIncompleteHelp("timeout"));
    }, CF_OAUTH_AUTHORIZE_WAIT_MS);
  }, [clearOauthWaitTimer]);

  const resolvedWorkerUrl = resolveWorkerUrl({
    role: "owner",
    ownerStatus: store.ownerStatus,
    teamStatus: store.teamStatus,
    credentials,
    teamLogin: null,
  });

  const runReset = useCallback(async () => {
    setIssueError(null);
    const workerUrl = resolvedWorkerUrl;
    if (!workerUrl) {
      setIssueError({
        title: "Worker URL missing",
        detail: "We need the product Worker URL before resetting your passtoken.",
        fix: "Finish setup or sign in once so the Worker URL is known, then try again.",
      });
      return;
    }
    try {
      await store.recoverOwner({
        workerUrl,
        cfAccessToken: "",
      });
      void desktopRegisterWorkerWithConsole(workerUrl).catch(() => {
        /* best-effort */
      });
    } catch (err) {
      setIssueError(explainPasstokenResetError(err));
    }
  }, [resolvedWorkerUrl, store]);

  useEffect(() => {
    return () => {
      clearOauthWaitTimer();
    };
  }, [clearOauthWaitTimer]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let active = true;
    listenCfOAuthResult({
      onComplete: () => {
        if (!active) return;
        void (async () => {
          await refresh();
          finishOauthWait({ error: null });
          await runReset();
        })();
      },
      onError: (message) => {
        if (!active) return;
        finishOauthWait({ error: explainCfOAuthError(message) });
      },
    }).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [finishOauthWait, refresh, runReset]);

  async function handleAuthorize() {
    setOauthBusy(true);
    setOauthError(null);
    setIssueError(null);
    startOauthWaitTimer();
    try {
      const start = await desktopStartCfOAuth();
      await desktopOpenExternal(start.authorizeUrl);
    } catch (err) {
      finishOauthWait({ error: explainCfOAuthError(err) });
    }
  }

  function handleCancelOauthWait() {
    finishOauthWait({ error: oauthAuthorizationIncompleteHelp("cancelled") });
  }

  async function copyToken() {
    const token = store.revealedPasstoken?.passtoken;
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopiedToken(true);
  }

  async function downloadToken() {
    const revealed = store.revealedPasstoken;
    if (!revealed) return;
    const content = [
      "# Relaybase owner passtoken — save this file securely",
      `# Worker URL: ${resolvedWorkerUrl}`,
      `# Username: ${revealed.username}`,
      `# Generated: ${new Date().toISOString()}`,
      "",
      `PASSTOKEN=${revealed.passtoken}`,
      "",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const filename = "relaybase-passtoken.txt";
    if (isDesktopRuntime()) {
      const buffer = await blob.arrayBuffer();
      await desktopSaveDownloadFile(filename, new Uint8Array(buffer));
    } else {
      downloadBlob(blob, filename);
    }
    setTokenDownloaded(true);
  }

  const revealed = store.revealedPasstoken;
  const workerUrl = resolvedWorkerUrl;

  return (
    <SetupCenteredPage
      backHref="/"
      backLabel="Back"
      backReplace
      onBack={() => store.leaveRecover()}
    >
      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Reset owner passtoken
          </h1>
          <p className="text-xs text-muted-foreground">
            Authorize the Cloudflare account that already has Relaybase. We
            will verify the account matches the Worker and re-issue your owner
            passtoken once. The old passtoken and all sessions are revoked.
          </p>
        </div>

        {revealed ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              New passtoken issued. Sign in with it once — the app does not
              store it.
            </p>
            <p className="text-xs text-muted-foreground">
              Worker URL: <span className="font-mono">{workerUrl}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Username: <span className="font-mono">{revealed.username}</span>
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[11px]">
                {revealed.passtoken}
              </code>
              <Button
                type="button"
                size="icon-sm"
                variant={copiedToken ? "default" : "outline"}
                aria-label="Copy passtoken"
                onClick={() => void copyToken()}
              >
                {copiedToken ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant={tokenDownloaded ? "default" : "outline"}
                aria-label="Download passtoken"
                onClick={() => void downloadToken()}
              >
                {tokenDownloaded ? (
                  <Check className="size-3.5" />
                ) : (
                  <Download className="size-3.5" />
                )}
              </Button>
            </div>
            {issueError ? <DesktopErrorBanner error={issueError} /> : null}
            <Button
              type="button"
              className="w-full"
              disabled={!copiedToken && !tokenDownloaded}
              onClick={() => {
                store.consumeRevealedPasstoken();
                router.replace("/");
              }}
            >
              Go to Mailbox
            </Button>
          </div>
        ) : store.busy ? (
          <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Verifying the Cloudflare account and re-issuing your passtoken…
          </div>
        ) : (
          <div className="space-y-3">
            <SetupCloudflareAuthorizeCard
              oauthBusy={oauthBusy}
              oauthError={oauthError}
              onAuthorize={() => void handleAuthorize()}
              onCancelWait={handleCancelOauthWait}
              authorizeLabel="Authorize with Cloudflare"
            />
            {issueError ? <DesktopErrorBanner error={issueError} /> : null}
          </div>
        )}
      </div>
    </SetupCenteredPage>
  );
}
