"use client";

import { Download, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { useOptionalAppUpdater } from "@/lib/desktop/updater/AppUpdaterContext";

export function AppUpdateBanner() {
  const updater = useOptionalAppUpdater();
  if (!updater) return null;

  const {
    phase,
    version,
    progressLabel,
    installNow,
    restartToUpdate,
  } = updater;
  if (phase === "idle") return null;

  if (phase === "ready" && version) {
    return (
      <div className="shrink-0 px-2 pb-2">
        <Card size="sm" className="gap-2 py-2.5 shadow-none">
          <CardContent className="px-2.5">
            <Button
              type="button"
              size="sm"
              className="h-7 w-full text-[11px]"
              onClick={() => void restartToUpdate()}
            >
              <RefreshCw className="size-3" />
              Restart to update (v{version})
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "available" && version) {
    return (
      <div className="shrink-0 px-2 pb-2">
        <Card size="sm" className="gap-2 py-2.5 shadow-none">
          <CardContent className="space-y-2 px-2.5">
            <p className="text-[11px] leading-tight text-foreground">
              Desktop update available{" "}
              <span className="font-mono">v{version}</span>
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-full text-[11px]"
              onClick={() => void installNow()}
            >
              Download &amp; install
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusText =
    phase === "checking"
      ? "Checking for updates…"
      : progressLabel ?? (version ? `Downloading v${version}…` : "Downloading update…");

  return (
    <div className="shrink-0 px-2 pb-2" role="status" aria-live="polite">
      <Card size="sm" className="gap-2 py-2.5 shadow-none">
        <CardContent className="flex items-start gap-2 px-2.5">
          <Download className="mt-0.5 size-3 shrink-0 opacity-80" aria-hidden />
          <p className="min-w-0 text-[11px] leading-snug text-foreground">
            {statusText}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Console Settings → Worker: manual desktop app update (same pattern as Worker). */
export function DesktopAppVersionSettingsCard() {
  const updater = useOptionalAppUpdater();

  if (!isDesktopRuntime() || !updater) return null;

  const {
    phase,
    currentVersion,
    version,
    progressLabel,
    statusMessage,
    lastError,
    checkNow,
    installNow,
    restartToUpdate,
  } = updater;

  const installed = currentVersion?.trim() || "unknown";
  const checking = phase === "checking";
  const downloading = phase === "downloading";
  const busy = checking || downloading;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">Desktop app version</p>
        <p className="mt-1 text-xs text-muted-foreground">
          In-app updater for the macOS app. Checks{" "}
          <span className="font-mono">relaybase.xyz/release/latest.json</span>.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Installed
          </p>
          <p className="font-mono text-sm">v{installed}</p>
        </div>
        {version && (phase === "available" || phase === "downloading" || phase === "ready") ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Available
            </p>
            <p className="font-mono text-sm text-amber-700 dark:text-amber-400">
              v{version}
            </p>
          </div>
        ) : null}
      </div>
      {progressLabel ? (
        <p className="text-sm text-muted-foreground" role="status">
          {progressLabel}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{statusMessage}</p>
      ) : null}
      {lastError ? <p className="text-sm text-destructive">{lastError}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || phase === "ready"}
          onClick={() => void checkNow()}
        >
          {checking ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Check for updates
        </Button>
        {phase === "available" && version ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void installNow()}
          >
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Download &amp; install v{version}
          </Button>
        ) : null}
        {phase === "ready" && version ? (
          <Button type="button" size="sm" onClick={() => void restartToUpdate()}>
            <RefreshCw className="size-3.5" />
            Restart to update (v{version})
          </Button>
        ) : null}
        {phase === "downloading" ? (
          <Button type="button" size="sm" disabled>
            <Loader2 className="size-3.5 animate-spin" />
            Downloading…
          </Button>
        ) : null}
      </div>
    </div>
  );
}
