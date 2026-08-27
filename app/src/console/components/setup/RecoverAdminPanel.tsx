"use client";

import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/attachments/download";
import {
  CF_OAUTH_AUTHORIZE_WAIT_MS,
  desktopOpenExternal,
  desktopRegisterWorkerWithConsole,
  desktopReissueAdminToken,
  desktopSaveDownloadFile,
  desktopStartCfOAuth,
  desktopVerifyWorkerConnection,
  explainCfOAuthError,
  explainDesktopError,
  isDesktopRuntime,
  listenCfOAuthResult,
  oauthAuthorizationIncompleteHelp,
  type DesktopErrorHelp,
  type ReissueAdminResult,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { markAdminTokenJustRotated } from "@/lib/desktop/unauthorized-grace";
import { SetupCloudflareAuthorizeCard } from "@/console/components/setup/SetupCloudflareAuthorizeCard";
import { SetupCenteredPage } from "@/console/components/setup/setup-page-chrome";

export function RecoverAdminPanel() {
  const { refresh } = useDesktop();
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<DesktopErrorHelp | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<DesktopErrorHelp | null>(null);
  const [done, setDone] = useState<ReissueAdminResult | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [tokenDownloaded, setTokenDownloaded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const issuingRef = useRef(false);
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

  const runReissue = useCallback(async () => {
    if (issuingRef.current) return;
    issuingRef.current = true;
    setIssuing(true);
    setIssueError(null);
    try {
      const result = await desktopReissueAdminToken();
      markAdminTokenJustRotated();
      void desktopRegisterWorkerWithConsole(result.workerUrl).catch(() => {
        /* best-effort */
      });
      await refresh();
      setDone(result);
    } catch (err) {
      setIssueError(explainDesktopError(err, "Could not reissue admin token"));
    } finally {
      issuingRef.current = false;
      setIssuing(false);
    }
  }, [refresh]);

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
          await runReissue();
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
  }, [finishOauthWait, refresh, runReissue]);

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

  async function retryVerify() {
    if (!done?.adminToken || verifying) return;
    setVerifying(true);
    setIssueError(null);
    try {
      await desktopVerifyWorkerConnection(done.workerUrl, done.adminToken);
      markAdminTokenJustRotated();
      setDone({ ...done, verified: true });
    } catch (err) {
      setIssueError(
        explainDesktopError(err, "Worker has not accepted the new token yet"),
      );
    } finally {
      setVerifying(false);
    }
  }

  async function copyToken() {
    if (!done?.adminToken) return;
    await navigator.clipboard.writeText(done.adminToken);
    setCopiedToken(true);
  }

  async function downloadToken() {
    if (!done?.adminToken) return;
    const content = [
      "# Relaybase admin token — save this file securely",
      `# Worker URL: ${done.workerUrl}`,
      `# Generated: ${new Date().toISOString()}`,
      "",
      `ADMIN_TOKEN=${done.adminToken}`,
      "",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const filename = "relaybase-admin-token.txt";
    if (isDesktopRuntime()) {
      const buffer = await blob.arrayBuffer();
      await desktopSaveDownloadFile(filename, new Uint8Array(buffer));
    } else {
      downloadBlob(blob, filename);
    }
    setTokenDownloaded(true);
  }

  return (
    <SetupCenteredPage
      backHref="/setup/connect"
      backLabel="Back"
    >
      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Reissue admin token
          </h1>
          <p className="text-xs text-muted-foreground">
            Authorize the Cloudflare account that already has Relaybase. We
            will generate a new admin token and push it as the Worker{" "}
            <code className="font-mono">ADMIN_TOKEN</code> secret.
          </p>
        </div>

        {done ? (
          <div className="space-y-3">
            <p
              className={
                done.verified !== false
                  ? "text-sm font-medium text-emerald-700 dark:text-emerald-400"
                  : "text-sm font-medium text-amber-700 dark:text-amber-400"
              }
            >
              {done.verified !== false
                ? "New admin token is on your Worker."
                : "New admin token is saved — waiting for the Worker to accept it."}
            </p>
            <p className="text-xs text-muted-foreground">
              Worker URL:{" "}
              <span className="font-mono">{done.workerUrl}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Copy this token and save it. You can reissue it again from
              Connect existing Worker if you lose it.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[11px]">
                {done.adminToken}
              </code>
              <Button
                type="button"
                size="icon-sm"
                variant={copiedToken ? "default" : "outline"}
                aria-label="Copy admin token"
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
                aria-label="Download admin token"
                onClick={() => void downloadToken()}
              >
                {tokenDownloaded ? (
                  <Check className="size-3.5" />
                ) : (
                  <Download className="size-3.5" />
                )}
              </Button>
            </div>
            {done.verified === false ? (
              <>
                {issueError ? <DesktopErrorBanner error={issueError} /> : null}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={verifying}
                  onClick={() => void retryVerify()}
                >
                  {verifying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Retry verify
                </Button>
              </>
            ) : null}
            {!copiedToken && !tokenDownloaded ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Copy this token to unlock Go to Mailbox.
              </p>
            ) : done.verified === false ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Wait until the Worker accepts the token, then Go to Mailbox.
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={
                done.verified === false || (!copiedToken && !tokenDownloaded)
              }
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.assign("/");
                }
              }}
            >
              Go to Mailbox
            </Button>
          </div>
        ) : issuing ? (
          <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Issuing a new admin token and waiting for the Worker…
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
