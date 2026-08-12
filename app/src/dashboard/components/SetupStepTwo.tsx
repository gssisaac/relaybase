"use client";

import { ArrowLeft, Check, Copy, Loader2, Terminal } from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import type { DesktopErrorHelp, InstallLogEvent } from "@/lib/desktop/bridge";
import { AdminTokenPanel } from "@/dashboard/components/AdminTokenPanel";

type AutoDone = { workerUrl: string; adminToken: string } | null;

export function StepTwoBody({
  mode,
  autoDone,
  busy,
  error,
  message,
  logs,
  logEndRef,
  cfApiToken,
  adminToken,
  setAdminToken,
  copiedToken,
  onCopyAutoToken,
  onAutoInstall,
  onPrev,
  onOpenDone,
}: {
  mode: "auto" | "manual";
  autoDone: AutoDone;
  busy: "auto" | "verify" | null;
  error: DesktopErrorHelp | null;
  message: string | null;
  logs: InstallLogEvent[];
  logEndRef: RefObject<HTMLDivElement | null>;
  cfApiToken: string;
  adminToken: string;
  setAdminToken: (t: string) => void;
  copiedToken: boolean;
  onCopyAutoToken: () => void;
  onAutoInstall: () => void;
  onPrev: () => void;
  onOpenDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step 2 of 2
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Install</h1>
      </div>

      {mode === "auto" ? (
        <>
          {autoDone ? (
            <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Installed and connected
              </p>
              <p className="text-xs text-muted-foreground">
                Worker URL:{" "}
                <span className="font-mono">{autoDone.workerUrl}</span>
              </p>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Save this admin token — it&apos;s the only way to recover your
                  Worker if you lose this Mac. Relaybase cannot recover it for
                  you.
                </p>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-[11px]">
                    {autoDone.adminToken}
                  </code>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="Copy admin token"
                    onClick={onCopyAutoToken}
                  >
                    {copiedToken ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                We&apos;ll create the KV namespace, R2 bucket, set the admin
                token, and deploy — all in your Cloudflare account. Watch the
                log below.
              </p>
              <Button
                type="button"
                className="w-full"
                disabled={!cfApiToken.trim() || busy !== null}
                onClick={onAutoInstall}
              >
                {busy === "auto" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Terminal className="size-3.5" />
                )}
                Install into my Cloudflare account
              </Button>
              <DesktopErrorBanner error={error} />
              {message ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  {message}
                </p>
              ) : null}
            </>
          )}

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
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Generate an admin token, copy the full install command, and run it
            in a terminal. When <span className="font-mono">wrangler deploy</span>{" "}
            prints your Worker URL, come back and tap &ldquo;I&apos;m
            done&rdquo;.
          </p>
          <AdminTokenPanel value={adminToken} onChange={setAdminToken} />
          <DesktopErrorBanner error={error} />
          <Button
            type="button"
            className="w-full"
            disabled={!adminToken.trim() || busy !== null}
            onClick={onOpenDone}
          >
            {busy === "verify" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            I&apos;m done — verify Worker
          </Button>
        </>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          onClick={onPrev}
        >
          <ArrowLeft className="size-3" />
          Prev
        </button>
        {autoDone ? (
          <Button type="button" onClick={() => {
            if (typeof window !== "undefined") {
              window.location.assign("/");
            }
          }}>
            Continue to dashboard
          </Button>
        ) : null}
      </div>
    </div>
  );
}
