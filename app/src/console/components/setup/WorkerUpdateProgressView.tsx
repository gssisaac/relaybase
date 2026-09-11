"use client";

import { ChevronDown, ChevronUp, Loader2, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { stripAnsi } from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/shell";
import { useWorkerUpdateRunner } from "@/lib/desktop/worker-update/WorkerUpdateRunnerContext";
import { SetupBackLink, SetupScrollPage } from "@/console/components/setup/setup-page-chrome";

const SETTINGS_WORKER_HOME = "/settings/worker";
const SETTINGS_WORKER_UPDATE = "/settings/worker/update";

/**
 * Lightweight viewer for `useWorkerUpdateRunner()`. The runner lives above
 * the router outlet, so the update keeps running (and its toast still fires)
 * even if the user navigates away from this page — this view only reflects
 * whatever state is already in flight.
 */
export function WorkerUpdateProgressView() {
  const router = useRouter();
  const runner = useWorkerUpdateRunner();
  const [logsExpanded, setLogsExpanded] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const startedHereRef = useRef(false);

  useEffect(() => {
    if (runner.phase !== "idle" || startedHereRef.current) return;
    startedHereRef.current = true;
    void (async () => {
      const res = await runner.start();
      if (res.ok) return;
      // Landed here directly (e.g. back/forward) without a live run and
      // without a fresh silent check — send back to the Approve screen,
      // which re-authorizes or shows the account-mismatch explanation.
      router.replace(SETTINGS_WORKER_UPDATE);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (logEndRef.current && logsExpanded) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [runner.logs, logsExpanded]);

  useEffect(() => {
    if (runner.phase !== "done") return;
    const t = window.setTimeout(() => router.replace(SETTINGS_WORKER_HOME), 600);
    return () => window.clearTimeout(t);
  }, [runner.phase, router]);

  const running = runner.phase === "checking" || runner.phase === "running";

  return (
    <SetupScrollPage maxWidth="max-w-[600px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Updating Worker
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            R2 and D1 stay as they are. You can leave this page — the update
            keeps running and you&apos;ll get a notification when it&apos;s done.
          </p>
        </div>

        <div className="flex justify-end">
          <SetupBackLink href={SETTINGS_WORKER_HOME} label="Back to Worker settings" />
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          {running ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                Installing…
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runner.cancel()}
              >
                <Square className="size-3 fill-current" />
                Stop
              </Button>
            </div>
          ) : runner.phase === "done" ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Worker updated
              {runner.updatedVersion ? ` to v${runner.updatedVersion}` : ""}.
            </p>
          ) : runner.phase === "error" ? (
            <DesktopErrorBanner error={runner.error} />
          ) : (
            <p className="text-sm text-muted-foreground">Stopped.</p>
          )}

          {runner.phase === "error" ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                runner.reset();
                startedHereRef.current = false;
                void runner.start();
              }}
            >
              Try again
            </Button>
          ) : null}

          {runner.logs.length > 0 ? (
            logsExpanded ? (
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setLogsExpanded(false)}
                >
                  Hide logs
                  <ChevronUp className="size-3.5" />
                </button>
                <div
                  ref={logEndRef}
                  className="max-h-56 select-text cursor-text overflow-y-auto rounded bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-300"
                >
                  {runner.logs.map((entry, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      <span className="text-muted-foreground">
                        [{entry.step}:{entry.level}]
                      </span>{" "}
                      {stripAnsi(entry.line)}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-between"
                onClick={() => setLogsExpanded(true)}
              >
                Show logs
                <ChevronDown className="size-3.5" />
              </Button>
            )
          ) : null}
        </div>
      </div>
    </SetupScrollPage>
  );
}
