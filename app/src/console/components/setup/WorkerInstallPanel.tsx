"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
import {
  desktopAutoInstallWorker,
  desktopOpenExternal,
  desktopRefreshInstallToken,
  desktopRegisterWorkerWithConsole,
  desktopSaveWorkerConnection,
  desktopStartCfOAuth,
  desktopVerifyWorkerConnection,
  explainCfOAuthError,
  explainDesktopError,
  listenCfOAuthResult,
  listenInstallLog,
  type DesktopErrorHelp,
  type InstallLogEvent,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { formatRelativeDate } from "@/lib/utils";
import { SetupStepper, WhatWeInstall } from "@/console/components/setup/SetupWizardParts";
import { StepTwoBody } from "@/console/components/setup/SetupStepTwo";
import { HealthStatus } from "@/console/pages/settings/settings-shared";

const DRAFT_KEY = "relaybase.setup.install.draft";

type Draft = {
  adminToken: string;
  workerUrl: string;
};

function emptyDraft(): Draft {
  return { adminToken: "", workerUrl: "" };
}

function accessTokenExpiryDetail(iso: string): string {
  const expiresAt = new Date(iso);
  if (Number.isNaN(expiresAt.getTime())) return "";
  const relative = formatRelativeDate(iso);
  if (expiresAt.getTime() <= Date.now()) {
    return ` Access token expired ${relative}.`;
  }
  return ` Access token expires ${relative}.`;
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
      adminToken:
        typeof parsed.adminToken === "string" ? parsed.adminToken : "",
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

function generateAdminToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `rb_admin_${hex}`;
}

export function WorkerInstallPanel() {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [workerUrl, setWorkerUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<"auto" | "verify" | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<DesktopErrorHelp | null>(null);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<InstallLogEvent[]>([]);
  const [autoDone, setAutoDone] = useState<{
    workerUrl: string;
    adminToken: string;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneUrl, setDoneUrl] = useState("");
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const draft = loadDraft();
    setWorkerUrl(draft.workerUrl || credentials?.workerUrl || "");
    setAdminToken(draft.adminToken || credentials?.adminToken || "");
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ adminToken, workerUrl });
  }, [hydrated, adminToken, workerUrl]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (step === 2 && mode === "manual" && !adminToken.trim()) {
      setAdminToken(generateAdminToken());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode]);

  useEffect(() => {
    if (!copiedToken) return;
    const t = window.setTimeout(() => setCopiedToken(false), 2000);
    return () => window.clearTimeout(t);
  }, [copiedToken]);

  // Same CF OAuth listener as Settings → Cloudflare. Rust completes the
  // exchange (loopback or relaybase://) and emits cf-oauth-complete.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let active = true;
    listenCfOAuthResult({
      onComplete: () => {
        if (!active) return;
        void (async () => {
          await refresh();
          setOauthBusy(false);
          setOauthError(null);
        })();
      },
      onError: (message) => {
        if (!active) return;
        setOauthError(explainCfOAuthError(message));
        setOauthBusy(false);
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

  const cfOAuthConnected = Boolean(
    credentials?.cfOauthRefreshToken?.trim() ||
      credentials?.cfOauthAccessToken?.trim(),
  );
  const cfOAuthAccountId =
    credentials?.cfOauthAccountId?.trim() ||
    credentials?.accountId?.trim() ||
    "";
  const cfOAuthExpiresAt = credentials?.cfOauthAccessExpiresAt?.trim() ?? "";

  function installTokenFromCredentials() {
    return (
      credentials?.cfOauthAccessToken?.trim() ||
      credentials?.installToken?.trim() ||
      ""
    );
  }

  async function handleStartCfOAuth() {
    setOauthBusy(true);
    setOauthError(null);
    try {
      const start = await desktopStartCfOAuth();
      await desktopOpenExternal(start.authorizeUrl);
    } catch (err) {
      setOauthError(explainCfOAuthError(err));
      setOauthBusy(false);
    }
  }

  async function persistAndContinue(opts: {
    url: string;
    token: string;
    scriptName?: string;
  }) {
    await desktopSaveWorkerConnection({
      workerUrl: opts.url,
      adminToken: opts.token,
      workerScriptName: opts.scriptName,
    });
    void desktopRegisterWorkerWithConsole(opts.url).catch(() => {
      /* best-effort */
    });
    await refresh();
    router.replace("/");
  }

  async function handleAutoInstall() {
    setBusy("auto");
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
        fix: "Go back to step 1 and click Connect with Cloudflare.",
      });
      setBusy(null);
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
      setError(explainDesktopError(err, "Auto-install failed"));
    } finally {
      if (unlisten) unlisten();
      setBusy(null);
    }
  }

  async function handleDoneVerify() {
    setBusy("verify");
    setError(null);
    const url = doneUrl.trim();
    const token = adminToken;
    try {
      const result = await desktopVerifyWorkerConnection(url, token);
      setDoneOpen(false);
      await persistAndContinue({
        url: result.workerUrl,
        token,
        scriptName: result.workerScriptName,
      });
    } catch (err) {
      setError(explainDesktopError(err, "Could not verify Worker"));
    } finally {
      setBusy(null);
    }
  }

  async function copyAutoToken() {
    if (!autoDone?.adminToken) return;
    await navigator.clipboard.writeText(autoDone.adminToken);
    setCopiedToken(true);
  }

  const canContinueFromStep1 = mode === "manual" || cfOAuthConnected;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <SetupStepper step={step} />
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          onClick={() => router.push("/setup")}
        >
          <ArrowLeft className="size-3" />
          Back to start
        </button>
      </div>

      <div className="space-y-6">
        <div className="min-w-0 space-y-6">
          {/* STEP 1 */}
          {step === 1 ? (
            <>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Step 1 of 2
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Get ready
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Relaybase runs entirely in <strong>your</strong> Cloudflare
                  account. Your email, API keys, and routing data never touch
                  Relaybase servers. Requires a Cloudflare Workers Paid plan
                  (Pro and up).
                </p>
              </div>

              <WhatWeInstall />

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Install method</p>
                  <Tabs
                    value={mode}
                    onValueChange={(v) =>
                      setMode(v === "manual" ? "manual" : "auto")
                    }
                  >
                    <TabsList>
                      <TabsTrigger value="auto">Recommended</TabsTrigger>
                      <TabsTrigger value="manual">Manual</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === "auto"
                    ? "The desktop installs the Worker for you in the background — you watch each step in the log. Your Cloudflare connection stays on this Mac."
                    : "You run the install commands yourself in a terminal, then come back and verify. Use this if you prefer full control."}
                </p>
              </div>

              {mode === "auto" ? (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Cloudflare account</p>
                    <p className="text-xs text-muted-foreground">
                      Connect your Cloudflare account to authorize Relaybase to
                      deploy and create resources (Workers / R2 / D1). Same
                      OAuth connection as Settings — no token to paste.
                    </p>
                  </div>
                  <HealthStatus
                    tone={cfOAuthConnected ? "ok" : "bad"}
                    label={
                      cfOAuthConnected
                        ? "Connected via OAuth"
                        : "Not connected"
                    }
                    detail={
                      cfOAuthConnected
                        ? `Account ${cfOAuthAccountId || "—"} is authorized. Relaybase can deploy and create resources.${
                            cfOAuthExpiresAt
                              ? accessTokenExpiryDetail(cfOAuthExpiresAt)
                              : ""
                          }`
                        : "Click Connect with Cloudflare to authorize Relaybase. You'll be sent to Cloudflare to approve, then return here."
                    }
                  />
                  <DesktopErrorBanner error={oauthError} />
                  <Button
                    type="button"
                    size="sm"
                    disabled={oauthBusy}
                    onClick={() => void handleStartCfOAuth()}
                  >
                    {oauthBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    {cfOAuthConnected
                      ? "Reconnect with Cloudflare"
                      : "Connect with Cloudflare"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-border p-4 text-xs text-muted-foreground">
                  You&apos;ll generate an admin token on the next step and copy a
                  single command that downloads, unpacks, and deploys the
                  Worker. No Cloudflare API token is needed for manual install.
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                  onClick={() => router.push("/setup")}
                >
                  <ArrowLeft className="size-3" />
                  Back to start
                </button>
                <Button
                  type="button"
                  disabled={!canContinueFromStep1}
                  onClick={() => setStep(2)}
                >
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <StepTwoBody
              mode={mode}
              autoDone={autoDone}
              busy={busy}
              error={error}
              message={message}
              logs={logs}
              logEndRef={logEndRef}
              canAutoInstall={cfOAuthConnected}
              cfAccountId={cfOAuthAccountId}
              adminToken={adminToken}
              setAdminToken={setAdminToken}
              copiedToken={copiedToken}
              onCopyAutoToken={() => void copyAutoToken()}
              onAutoInstall={() => void handleAutoInstall()}
              onPrev={() => setStep(1)}
              onOpenDone={() => {
                setDoneUrl(workerUrl);
                setDoneOpen(true);
              }}
            />
          )}
        </div>
      </div>

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify your Worker</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Paste the <span className="font-mono">*.workers.dev</span> URL that
            <span className="font-mono"> wrangler deploy</span> printed. We&apos;ll
            verify it with the admin token you generated.
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
