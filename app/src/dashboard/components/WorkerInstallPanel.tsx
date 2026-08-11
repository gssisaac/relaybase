"use client";

import { Download, Loader2, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WORKER_INSTALL_ZIP_URL,
  desktopAutoInstallWorker,
  desktopOpenExternal,
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

const DRAFT_KEY = "relaybase.setup.install.draft";

type Draft = {
  workerUrl: string;
  adminToken: string;
};

function loadDraft(): Draft {
  if (typeof window === "undefined") {
    return { workerUrl: "", adminToken: "" };
  }
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return { workerUrl: "", adminToken: "" };
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      workerUrl: typeof parsed.workerUrl === "string" ? parsed.workerUrl : "",
      adminToken:
        typeof parsed.adminToken === "string" ? parsed.adminToken : "",
    };
  } catch {
    return { workerUrl: "", adminToken: "" };
  }
}

function saveDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

const RESOURCE_NAMES = [
  {
    name: "relaybase-api",
    kind: "Worker",
    why: "Your routing + admin API process. You deploy it with Wrangler; the Mac app only talks to this URL.",
  },
  {
    name: "relaybase-app",
    kind: "KV",
    why: "Stores Relaybase runtime data, admin config, and API keys inside your account.",
  },
  {
    name: "relaybase-inbound",
    kind: "R2",
    why: "Stores raw inbound email. Created automatically during auto-install.",
  },
] as const;

export function WorkerInstallPanel() {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [cfApiToken, setCfApiToken] = useState("");
  const [workerUrl, setWorkerUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<"auto" | "verify" | "skip" | null>(null);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<InstallLogEvent[]>([]);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Restore draft / saved creds once — never wipe on failed verify.
  useEffect(() => {
    const draft = loadDraft();
    setWorkerUrl(draft.workerUrl || credentials?.workerUrl || "");
    setAdminToken(draft.adminToken || credentials?.adminToken || "");
    setHydrated(true);
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ workerUrl, adminToken });
  }, [hydrated, workerUrl, adminToken]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  async function persistAndContinue(opts: {
    url: string;
    token: string;
    scriptName?: string;
    skippedVerify: boolean;
  }) {
    await desktopSaveWorkerConnection({
      workerUrl: opts.url,
      adminToken: opts.token,
      workerScriptName: opts.scriptName,
    });
    setMessage(
      opts.skippedVerify
        ? `Saved ${opts.url} (verify skipped). Continuing…`
        : `Connected to ${opts.url}`,
    );
    await refresh();
    router.replace("/");
  }

  async function handleAutoInstall() {
    setBusy("auto");
    setError(null);
    setMessage(null);
    setLogs([]);
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
      setWorkerUrl(result.workerUrl);
      setAdminToken(result.adminToken);
      const connect = await desktopVerifyWorkerConnection(
        result.workerUrl,
        result.adminToken,
      );
      await persistAndContinue({
        url: connect.workerUrl,
        token: result.adminToken,
        scriptName: connect.workerScriptName,
        skippedVerify: false,
      });
    } catch (err) {
      setError(explainDesktopError(err, "Auto-install failed"));
    } finally {
      if (unlisten) unlisten();
      setBusy(null);
    }
  }

  async function handleVerify() {
    setBusy("verify");
    setError(null);
    setMessage(null);
    const url = workerUrl;
    const token = adminToken;
    try {
      const result = await desktopVerifyWorkerConnection(url, token);
      await persistAndContinue({
        url: result.workerUrl,
        token,
        scriptName: result.workerScriptName,
        skippedVerify: false,
      });
    } catch (err) {
      setWorkerUrl(url);
      setAdminToken(token);
      setError(explainDesktopError(err, "Could not verify Worker"));
    } finally {
      setBusy(null);
    }
  }

  async function handleSkip() {
    setBusy("skip");
    setError(null);
    setMessage(null);
    const url = workerUrl.trim();
    const token = adminToken.trim();
    try {
      if (!url || !token) {
        throw new Error("Worker URL and Admin token are required to continue.");
      }
      await persistAndContinue({
        url,
        token,
        scriptName: "relaybase-api",
        skippedVerify: true,
      });
    } catch (err) {
      setWorkerUrl(workerUrl);
      setAdminToken(adminToken);
      setError(explainDesktopError(err, "Could not save connection"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Setup
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Install routing Worker
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Relaybase runs in <strong>your</strong> Cloudflare account. Enter a
          Cloudflare API token and the desktop installs the Worker for you —
          you&apos;ll watch each step in the log below. Your token stays on this
          Mac and is never sent to Relaybase.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">What gets created (and why)</p>
        <ul className="space-y-3">
          {RESOURCE_NAMES.map((r) => (
            <li key={`${r.kind}-${r.name}`} className="text-sm">
              <p className="font-mono text-xs">
                <span className="text-muted-foreground">{r.kind}</span>{" "}
                <span className="font-medium text-foreground">{r.name}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.why}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Cloudflare may bill a small Workers Paid plan fee (≈$5/mo) directly
          to you. Relaybase Pro is a separate software license.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {mode === "auto" ? "Auto-install" : "Manual install"}
          </p>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => setMode(mode === "auto" ? "manual" : "auto")}
          >
            {mode === "auto" ? "Use manual install" : "Use auto-install"}
          </button>
        </div>

        {mode === "auto" ? (
          <>
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
            <Button
              type="button"
              className="w-full"
              disabled={!cfApiToken.trim() || busy !== null}
              onClick={() => void handleAutoInstall()}
            >
              {busy === "auto" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Terminal className="size-3.5" />
              )}
              Install into my Cloudflare account
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Download the install package and deploy with Wrangler yourself,
              then paste the Worker URL + admin token below.
            </p>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void desktopOpenExternal(WORKER_INSTALL_ZIP_URL)}
            >
              <Download className="size-3.5" />
              Download Worker install ZIP
            </Button>
          </>
        )}
      </div>

      {logs.length > 0 ? (
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

      <AdminTokenPanel value={adminToken} onChange={setAdminToken} />

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Connect</p>
        <div className="space-y-1.5">
          <Label htmlFor="worker-url">Worker URL</Label>
          <Input
            id="worker-url"
            value={workerUrl}
            onChange={(e) => setWorkerUrl(e.target.value)}
            placeholder="https://relaybase-api.<subdomain>.workers.dev"
            className="font-mono text-xs"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-token-verify">Admin token (for Verify)</Label>
          <Input
            id="admin-token-verify"
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="Paste the token you put in wrangler secret"
            className="font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <DesktopErrorBanner error={error} />
        {message ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={!workerUrl.trim() || !adminToken.trim() || busy !== null}
            onClick={() => void handleVerify()}
          >
            {busy === "verify" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Verify &amp; continue
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!workerUrl.trim() || !adminToken.trim() || busy !== null}
            onClick={() => void handleSkip()}
          >
            {busy === "skip" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Skip verify &amp; continue
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Skip saves the URL and token locally and continues. Use this when
            the Worker is already deployed and verify is stuck.
          </p>
        </div>
      </div>
    </div>
  );
}
