"use client";

// Browser-native Cloudflare install flow — the web equivalent of
// WorkerInstallPanel + SetupProgressPanel's desktop (Tauri) auto-install.
// No OS keyring, no Touch ID, no Tauri invoke: OAuth tokens live server-side
// in a sealed cookie (see app/src/server/cloudflare/session.ts) and the
// install pipeline streams over SSE from /api/install/stream.
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadPasstokenBackup } from "@/lib/desktop/worker-url/download-passtoken-backup";

type InstallLogEvent = { step: string; level: "info" | "stderr"; line: string };

type InstallDone = {
  workerUrl: string;
  workerScriptName: string;
  workerVersion: string;
  passtoken: string | null;
  ownerAlreadyConfigured: boolean;
};

/** Cloudflare's authorize page, in a browser tab, needs one screen. */
export function WebAuthorizeCard() {
  return (
    <div className="flex min-h-100 flex-col items-center justify-center gap-4 py-2 text-center">
      <p className="text-sm text-muted-foreground max-w-sm">
        Relaybase runs entirely in your own Cloudflare account. Click below to sign in with
        Cloudflare and authorize creating a Worker, R2 bucket, and D1 databases.
      </p>
      <Button
        type="button"
        className="w-[300px] max-w-full"
        onClick={() => {
          window.location.href = "/api/oauth/start";
        }}
      >
        Authorize and install on Cloudflare
      </Button>
    </div>
  );
}

/** Runs after the Cloudflare OAuth redirect lands the browser on /setup/progress. */
export function WebInstallProgress() {
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
      setDone(JSON.parse((e as MessageEvent).data));
      source.close();
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
      if (done.passtoken) {
        // Bootstrap an owner session directly against the deployed Worker —
        // the browser talks to it the same way the desktop app's console
        // shell does after `owner_login`.
        const res = await fetch(`${done.workerUrl.replace(/\/$/, "")}/console/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passtoken: done.passtoken, label: "web" }),
        });
        if (res.ok) {
          const session = await res.json();
          sessionStorage.setItem(
            "relaybase.owner-session",
            JSON.stringify({ workerUrl: done.workerUrl, ...session }),
          );
        }
      }
      window.location.href = "/dashboard";
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
