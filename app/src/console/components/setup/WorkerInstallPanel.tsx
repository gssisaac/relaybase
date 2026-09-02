"use client";

import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ownerAuthStatusForWorkerUrl } from "@/lib/desktop/auth";
import {
  CF_OAUTH_AUTHORIZE_WAIT_MS,
  desktopOpenExternal,
  desktopOwnerLogin,
  desktopOwnerSetupAdmin,
  desktopPreviewWorkerUpdateTarget,
  desktopRegisterWorkerWithConsole,
  desktopSaveWorkerConnection,
  desktopStartCfOAuth,
  desktopVerifyWorkerConnection,
  explainCfOAuthError,
  explainDesktopError,
  explainWorkerUpdateTargetError,
  listenCfOAuthResult,
  oauthAuthorizationIncompleteHelp,
  type DesktopErrorHelp,
  type WorkerUpdateTarget,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/shell";
import { downloadPasstokenBackup } from "@/lib/desktop/worker-url/download-passtoken-backup";
import { useDesktop } from "@/lib/desktop/shell";
import { ManualInstallScriptPanel } from "@/console/components/setup/AdminTokenPanel";
import { useOpenEnableEmailApiDialog } from "@/console/components/setup/use-enable-email-api-dialog";
import { SetupCloudflareAuthorizeCard } from "@/console/components/setup/SetupCloudflareAuthorizeCard";
import { SetupBackLink, SetupScrollPage } from "@/console/components/setup/setup-page-chrome";
import { WhatWeInstall } from "@/console/components/setup/SetupWizardParts";
import { WorkerUpdateTargetDialog } from "@/console/components/setup/WorkerUpdateTargetDialog";
import type { InstallFlowPurpose } from "@/console/lib/install-flow";

const DRAFT_KEY = "relaybase.setup.install.draft";

type Draft = {
  workerUrl: string;
};

function emptyDraft(): Draft {
  return { workerUrl: "" };
}

function loadDraft(): Draft {
  if (typeof window === "undefined") {
    return emptyDraft();
  }
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      workerUrl:
        typeof parsed.workerUrl === "string" ? parsed.workerUrl : "",
    };
  } catch {
    return emptyDraft();
  }
}

function saveDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

export function WorkerInstallPanel({
  purpose = "install",
}: {
  purpose?: InstallFlowPurpose;
}) {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
  const openEnableEmailApiDialog = useOpenEnableEmailApiDialog();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [workerUrl, setWorkerUrl] = useState("");
  const [installPepper, setInstallPepper] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<"verify" | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<DesktopErrorHelp | null>(null);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneUrl, setDoneUrl] = useState("");
  const [revealedPasstoken, setRevealedPasstoken] = useState<string | null>(
    null,
  );
  const [tokenSaved, setTokenSaved] = useState(false);
  const [tokenDownloaded, setTokenDownloaded] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [pendingContinue, setPendingContinue] = useState<{
    url: string;
    scriptName?: string;
  } | null>(null);
  const [targetPreview, setTargetPreview] = useState<WorkerUpdateTarget | null>(
    null,
  );
  const [targetConfirmOpen, setTargetConfirmOpen] = useState(false);
  const [targetChecking, setTargetChecking] = useState(false);
  const finishingRef = useRef(false);
  const modeRef = useRef(mode);
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

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const draft = loadDraft();
    setWorkerUrl(draft.workerUrl || credentials?.workerUrl || "");
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ workerUrl });
  }, [hydrated, workerUrl]);

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
          if (!active) return;
          if (modeRef.current !== "auto") {
            finishOauthWait({ error: null });
            return;
          }
          if (purpose === "worker-update") {
            setTargetChecking(true);
            try {
              const target = await desktopPreviewWorkerUpdateTarget();
              if (!active) return;
              setTargetPreview(target);
              setTargetConfirmOpen(true);
              finishOauthWait({
                error: target.matches
                  ? null
                  : {
                      title: "Wrong Cloudflare account",
                      detail: `Your Relaybase Worker is ${target.expectedWorkerUrl}. This login would update ${target.oauthWorkerUrl}.`,
                      fix: "Authorize again and pick the Cloudflare account that owns your Worker. Nothing was uploaded.",
                    },
              });
            } catch (err) {
              if (!active) return;
              finishOauthWait({
                error: explainWorkerUpdateTargetError(err),
              });
            } finally {
              if (active) setTargetChecking(false);
            }
            return;
          }
          finishOauthWait({ error: null });
          router.push("/setup/progress");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfOAuthAccountId =
    credentials?.cfOauthAccountId?.trim() ||
    credentials?.accountId?.trim() ||
    "";

  async function handleStartCfOAuth() {
    setOauthBusy(true);
    setOauthError(null);
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

  async function handleAuthorize() {
    await handleStartCfOAuth();
  }

  function finishAfterEmailApi(opts?: { url: string; scriptName?: string }) {
    const next = opts ?? pendingContinue;
    if (!next || finishingRef.current) return;
    finishingRef.current = true;
    void persistAndContinue(next);
  }

  async function persistAndContinue(opts: { url: string; scriptName?: string }) {
    await desktopSaveWorkerConnection({
      workerUrl: opts.url,
      workerScriptName: opts.scriptName,
    });
    void desktopRegisterWorkerWithConsole(opts.url).catch(() => {
      /* best-effort */
    });
    setInstallPepper("");
    await refresh();
    router.replace(purpose === "worker-update" ? "/settings/worker" : "/");
  }

  async function probeHealth(url: string): Promise<void> {
    const res = await fetch(`${url}/health`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        `Worker health check failed (${res.status}). Confirm wrangler deploy printed this URL.`,
      );
    }
  }

  async function handleDoneVerify() {
    setBusy("verify");
    setError(null);
    const url = doneUrl.trim().replace(/\/$/, "");
    try {
      await probeHealth(url);
      const status = await ownerAuthStatusForWorkerUrl(url);

      if (purpose === "install" && !status.ownerConfigured) {
        const pepper = installPepper.trim();
        if (!pepper) {
          throw new Error(
            "Install pepper is missing. Switch away from Manual and back, then copy the command again.",
          );
        }
        const issued = await desktopOwnerSetupAdmin({
          workerUrl: url,
          pepper,
        });
        await desktopOwnerLogin({
          workerUrl: url,
          passtoken: issued.passtoken,
        });
        setInstallPepper("");
        setRevealedPasstoken(issued.passtoken);
        setTokenSaved(false);
        setTokenDownloaded(false);
        setCopiedToken(false);
      } else if (purpose === "install" && status.ownerConfigured) {
        throw new Error(
          "An owner passtoken is already configured on this Worker. Sign in from Setup → Already installed.",
        );
      }

      const result = await desktopVerifyWorkerConnection(url);
      await desktopSaveWorkerConnection({
        workerUrl: result.workerUrl,
        workerScriptName: result.workerScriptName,
        workerVersion: result.version,
      });
      await refresh();
      const next = {
        url: result.workerUrl,
        scriptName: result.workerScriptName,
      };
      if (purpose === "worker-update") {
        setDoneOpen(false);
        await persistAndContinue(next);
        return;
      }
      setPendingContinue(next);
      if (!revealedPasstoken && purpose === "install" && !status.ownerConfigured) {
        /* reveal is set above; stay on dialog until they save it */
      }
    } catch (err) {
      setError(explainDesktopError(err, "Could not verify Worker"));
    } finally {
      setBusy(null);
    }
  }

  async function copyPasstoken() {
    if (!revealedPasstoken) return;
    await navigator.clipboard.writeText(revealedPasstoken);
    setCopiedToken(true);
    setTokenSaved(true);
  }

  async function downloadPasstoken() {
    if (!revealedPasstoken) return;
    await downloadPasstokenBackup(revealedPasstoken);
    setTokenDownloaded(true);
    setTokenSaved(true);
  }

  function continueAfterPasstoken() {
    const next = pendingContinue;
    if (!next) return;
    setDoneOpen(false);
    openEnableEmailApiDialog({
      allowSkip: true,
      accountId: cfOAuthAccountId,
      workerUrl: next.url,
      workerScriptName: next.scriptName,
      onVerified: () => finishAfterEmailApi(next),
      onSkip: () => finishAfterEmailApi(next),
      onClose: () => finishAfterEmailApi(next),
    });
  }

  function handleModeChange(next: "auto" | "manual") {
    if (next === mode) return;
    if (oauthBusy) {
      handleCancelOauthWait();
    }
    setMode(next);
  }

  const canContinueAfterReveal =
    Boolean(revealedPasstoken) && (tokenSaved || tokenDownloaded);

  return (
    <SetupScrollPage>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {purpose === "worker-update" ? "Update Worker" : "Get ready"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {purpose === "worker-update"
              ? "Replace the Worker script in your Cloudflare account. After you authorize, we compare that account's Worker URL with the one Relaybase already uses. They must match or we stop — nothing is uploaded. R2 and D1 stay as they are."
              : "Relaybase runs entirely in your Cloudflare account. Your email, API keys, and routing data never touch Relaybase servers. Install and receive mail on the free plan; sending email requires a Cloudflare Workers Paid plan (~$5/mo, billed by Cloudflare)."}
          </p>
          {purpose === "worker-update" && credentials?.workerUrl ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Saved Worker:{" "}
              <span className="break-all font-mono">{credentials.workerUrl}</span>
            </p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <SetupBackLink
            href={purpose === "worker-update" ? "/settings/worker" : "/setup"}
            label={
              purpose === "worker-update" ? "Back to Worker settings" : "Back to start"
            }
          />
        </div>

        <div className="flex min-h-100 flex-col rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {purpose === "worker-update" ? "Update method" : "Install method"}
            </p>
            <Tabs
              value={mode}
              onValueChange={(v) =>
                handleModeChange(v === "manual" ? "manual" : "auto")
              }
            >
              <TabsList>
                <TabsTrigger value="auto">Recommended</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {mode === "auto"
              ? purpose === "worker-update"
                ? "Authorize the Cloudflare account that owns your saved Worker. We show both URLs before any upload."
                : "Authorize Relaybase to deploy and create Workers, R2, and D1 in your Cloudflare account."
              : purpose === "worker-update"
                ? "Copy the update command, deploy the Worker, then come back. Schema uses your owner session."
                : "If you do not have Wrangler, start with step 1. Worker overwrite is fine. Be careful with existing D1 and R2. Verify is optional."}
          </p>

          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            {mode === "auto" ? (
              <SetupCloudflareAuthorizeCard
                oauthBusy={oauthBusy || targetChecking}
                oauthError={oauthError}
                onAuthorize={() => void handleAuthorize()}
                onCancelWait={handleCancelOauthWait}
                authorizeLabel={
                  purpose === "worker-update"
                    ? "Authorize with Cloudflare"
                    : "Authorize and install on Cloudflare"
                }
                waitingLabel={
                  targetChecking
                    ? "Checking Worker URL…"
                    : "Waiting for authorization…"
                }
                showCancelWait={!targetChecking}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <ManualInstallScriptPanel
                  onPepperChange={setInstallPepper}
                  cfAccountId={cfOAuthAccountId}
                  workerUrl={workerUrl}
                  onWorkerUrlChange={setWorkerUrl}
                  variant={
                    purpose === "worker-update" ? "worker-update" : "install"
                  }
                />
                <DesktopErrorBanner error={error} />
                <div className="mt-auto">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      busy !== null ||
                      (purpose === "install" && !installPepper.trim())
                    }
                    onClick={() => {
                      setDoneUrl(workerUrl);
                      setDoneOpen(true);
                      setRevealedPasstoken(null);
                      setError(null);
                    }}
                  >
                    {busy === "verify" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    I&apos;m done — verify Worker
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {purpose === "install" ? <WhatWeInstall /> : null}
      </div>

      <Dialog
        open={doneOpen}
        onOpenChange={(open) => {
          if (busy !== null) return;
          if (!open && revealedPasstoken && !canContinueAfterReveal) return;
          setDoneOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {revealedPasstoken
                ? "Save your passtoken"
                : "Verify your Worker"}
            </DialogTitle>
          </DialogHeader>
          {revealedPasstoken ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Shown once. Copy or download a backup — this Mac also stores it
                in the keyring, and Touch ID reads it later.
              </p>
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <code className="block break-all font-mono text-[11px]">
                  {revealedPasstoken}
                </code>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant={copiedToken || tokenSaved ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => void copyPasstoken()}
                >
                  {copiedToken ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  Copy passtoken
                </Button>
                <Button
                  type="button"
                  variant={tokenDownloaded ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => void downloadPasstoken()}
                >
                  {tokenDownloaded ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Download .txt
                </Button>
              </div>
              {canContinueAfterReveal ? (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Passtoken saved. You can continue.
                </p>
              ) : (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Copy or download before continuing.
                </p>
              )}
              <DialogFooter>
                <Button
                  disabled={!canContinueAfterReveal}
                  onClick={continueAfterPasstoken}
                >
                  Continue
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Paste the <span className="font-mono">*.workers.dev</span> URL
                that <span className="font-mono">wrangler deploy</span> printed.
                {purpose === "install"
                  ? " The Worker will issue your owner passtoken once."
                  : " We verify with your owner session."}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="done-worker-url">Worker URL</Label>
                <Input
                  id="done-worker-url"
                  value={doneUrl}
                  onChange={(e) => setDoneUrl(e.target.value)}
                  placeholder="https://relaybase-api.<subdomain>.workers.dev"
                  className="font-mono text-xs"
                  autoComplete="off"
                />
              </div>
              <DesktopErrorBanner error={error} />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDoneOpen(false)}
                  disabled={busy !== null}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!doneUrl.trim() || busy !== null}
                  onClick={() => void handleDoneVerify()}
                >
                  {busy === "verify" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Verify &amp; continue
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <WorkerUpdateTargetDialog
        open={targetConfirmOpen}
        target={targetPreview}
        confirming={targetChecking}
        onOpenChange={setTargetConfirmOpen}
        onConfirm={() => {
          if (!targetPreview?.matches) return;
          setTargetConfirmOpen(false);
          router.push("/settings/worker/progress");
        }}
        onAuthorizeAgain={() => {
          setTargetConfirmOpen(false);
          setTargetPreview(null);
          setOauthError(null);
          void handleAuthorize();
        }}
      />
    </SetupScrollPage>
  );
}
