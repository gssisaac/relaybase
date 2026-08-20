"use client";

import { Loader2 } from "lucide-react";
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
import {
  CF_OAUTH_AUTHORIZE_WAIT_MS,
  desktopOpenExternal,
  desktopRegisterWorkerWithConsole,
  desktopSaveWorkerConnection,
  desktopStartCfOAuth,
  desktopVerifyWorkerConnection,
  explainCfOAuthError,
  explainDesktopError,
  listenCfOAuthResult,
  oauthAuthorizationIncompleteHelp,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { AdminTokenPanel } from "@/console/components/setup/AdminTokenPanel";
import { SetupCloudflareAuthorizeCard } from "@/console/components/setup/SetupCloudflareAuthorizeCard";
import { SetupBackLink, SetupScrollPage } from "@/console/components/setup/setup-page-chrome";
import { WhatWeInstall } from "@/console/components/setup/SetupWizardParts";

const DRAFT_KEY = "relaybase.setup.install.draft";

type Draft = {
  adminToken: string;
  workerUrl: string;
};

function emptyDraft(): Draft {
  return { adminToken: "", workerUrl: "" };
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
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [workerUrl, setWorkerUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<"verify" | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<DesktopErrorHelp | null>(null);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneUrl, setDoneUrl] = useState("");
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
    setAdminToken(draft.adminToken || credentials?.adminToken || "");
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ adminToken, workerUrl });
  }, [hydrated, adminToken, workerUrl]);

  useEffect(() => {
    if (mode === "manual" && !adminToken.trim()) {
      setAdminToken(generateAdminToken());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    return () => {
      clearOauthWaitTimer();
    };
  }, [clearOauthWaitTimer]);

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
          finishOauthWait({ error: null });
          if (modeRef.current === "auto") {
            router.push("/setup/progress");
          }
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

  const cfOAuthConnected = Boolean(
    credentials?.cfOauthRefreshToken?.trim() ||
      credentials?.cfOauthAccessToken?.trim(),
  );
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
    if (cfOAuthConnected) {
      router.push("/setup/progress");
      return;
    }
    await handleStartCfOAuth();
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

  function handleModeChange(next: "auto" | "manual") {
    if (next === mode) return;
    if (oauthBusy) {
      handleCancelOauthWait();
    }
    setMode(next);
  }

  return (
    <SetupScrollPage>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Get ready</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Relaybase runs entirely in <strong>your</strong> Cloudflare account.
            Your email, API keys, and routing data never touch Relaybase
            servers. Requires a Cloudflare Workers Paid plan (Pro and up).
          </p>
        </div>

        <div className="flex justify-end">
          <SetupBackLink />
        </div>

        <div className="flex min-h-100 flex-col rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Install method</p>
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
              ? "Authorize Relaybase to deploy and create Workers, R2, and D1 in your Cloudflare account."
              : "Generate a token, copy the install command, and run it in a terminal."}
          </p>

          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            {mode === "auto" ? (
              <SetupCloudflareAuthorizeCard
                oauthBusy={oauthBusy}
                oauthError={oauthError}
                onAuthorize={() => void handleAuthorize()}
                onCancelWait={handleCancelOauthWait}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <AdminTokenPanel
                  value={adminToken}
                  onChange={setAdminToken}
                  cfAccountId={cfOAuthAccountId}
                />
                <DesktopErrorBanner error={error} />
                <div className="mt-auto">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!adminToken.trim() || busy !== null}
                    onClick={() => {
                      setDoneUrl(workerUrl);
                      setDoneOpen(true);
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

        <WhatWeInstall />
      </div>

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify your Worker</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Paste the <span className="font-mono">*.workers.dev</span> URL that
            <span className="font-mono"> wrangler deploy</span> printed.
            We&apos;ll verify it with the admin token you generated.
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
    </SetupScrollPage>
  );
}
