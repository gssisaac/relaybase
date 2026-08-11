"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Terminal,
} from "lucide-react";
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
  desktopRegisterWorkerWithConsole,
  desktopSaveWorkerConnection,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  listenInstallLog,
  type DesktopErrorHelp,
  type InstallLogEvent,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { AdminTokenPanel } from "@/dashboard/components/AdminTokenPanel";
import { ResourceAside, SetupStepper } from "@/dashboard/components/SetupWizardParts";
import { StepTwoBody } from "@/dashboard/components/SetupStepTwo";

const DRAFT_KEY = "relaybase.setup.install.draft";

type Draft = {
  cfApiToken: string;
  adminToken: string;
  workerUrl: string;
};

function loadDraft(): Draft {
  if (typeof window === "undefined") {
    return { cfApiToken: "", adminToken: "", workerUrl: "" };
  }
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return { cfApiToken: "", adminToken: "", workerUrl: "" };
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      cfApiToken:
        typeof parsed.cfApiToken === "string" ? parsed.cfApiToken : "",
      adminToken:
        typeof parsed.adminToken === "string" ? parsed.adminToken : "",
      workerUrl:
        typeof parsed.workerUrl === "string" ? parsed.workerUrl : "",
    };
  } catch {
    return { cfApiToken: "", adminToken: "", workerUrl: "" };
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
  const [cfApiToken, setCfApiToken] = useState("");
  const [workerUrl, setWorkerUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<"auto" | "verify" | null>(null);
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
    setCfApiToken(draft.cfApiToken);
    setWorkerUrl(draft.workerUrl || credentials?.workerUrl || "");
    setAdminToken(draft.adminToken || credentials?.adminToken || "");
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ cfApiToken, adminToken, workerUrl });
  }, [hydrated, cfApiToken, adminToken, workerUrl]);

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
    const token = cfApiToken.trim();
    if (!token) {
      setError({
        title: "Cloudflare API token required",
        detail:
          "Paste a Cloudflare API token with Workers Scripts / KV / R2 edit permissions.",
        fix: "Create one at dash.cloudflare.com → My Profile → API Tokens.",
        links: [
          {
            label: "Create a Cloudflare API token",
            href: "https://dash.cloudflare.com/profile/api-tokens",
          },
        ],
      });
      setBusy(null);
      return;
    }
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenInstallLog((event) => {
        setLogs((prev) => [...prev, event]);
      });
      const result = await desktopAutoInstallWorker(token);
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

  const canContinueFromStep1 =
    mode === "manual" || cfApiToken.trim().length > 0;

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

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-6">
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
                  Relaybase servers. Cloudflare bills you directly (&#8776;$5/mo
                  Workers Paid plan).
                </p>
              </div>

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
                    ? "The desktop installs the Worker for you in the background — you watch each step in the log. Your Cloudflare API token stays on this Mac."
                    : "You run the install commands yourself in a terminal, then come back and verify. Use this if you prefer full control."}
                </p>
              </div>

              {mode === "auto" ? (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cf-api-token">Cloudflare API token</Label>
                    <Input
                      id="cf-api-token"
                      type="password"
                      value={cfApiToken}
                      onChange={(e) => setCfApiToken(e.target.value)}
                      placeholder="cfut_…"
                      className="font-mono text-xs"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Stored only on this Mac (~/.relaybase). Requires Workers
                      Scripts, KV Storage, and R2 Storage edit scopes.
                    </p>
                  </div>
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
              cfApiToken={cfApiToken}
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
        <ResourceAside />
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
