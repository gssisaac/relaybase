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
import { downloadPasstokenBackup } from "@/lib/desktop/worker-url/download-passtoken-backup";
import { ownerLogin } from "@/lib/desktop/auth";
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

/** Cloudflare's authorize page, in a browser tab, needs one screen. */
export function WebAuthorizeCard({
  authorizeHref = "/api/oauth/start",
  description = "Relaybase runs entirely in your own Cloudflare account. Click below to sign in with Cloudflare and authorize creating a Worker, R2 bucket, and D1 databases.",
  buttonLabel = "Authorize and install on Cloudflare",
}: {
  authorizeHref?: string;
  description?: string;
  buttonLabel?: string;
}) {
  return (
    <div className="flex min-h-100 flex-col items-center justify-center gap-4 py-2 text-center">
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      <Button
        type="button"
        className="w-[300px] max-w-full"
        onClick={() => {
          window.location.href = authorizeHref;
        }}
      >
        {buttonLabel}
      </Button>
    </div>
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
        // same ownerLogin() the Account Login screen's owner tab uses, so
        // the rest of the app (workerFetch's Bearer path, WebOwnerSession)
        // picks it up. router.push (not a hard navigation) keeps this
        // in-memory-only session alive across the move to /dashboard.
        if (typeof window !== "undefined") {
          const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
          w.__RELAYBASE_WORKER_URL__ = workerUrl;
        }
        await ownerLogin({ passtoken: done.passtoken, label: "web" });
        router.push("/dashboard");
      } else {
        // An owner was already configured on this Worker — nothing to log
        // in with here. Send them to sign in with their existing passtoken.
        router.push(
          `/sign-in?workerUrl=${encodeURIComponent(workerUrl)}`,
        );
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
