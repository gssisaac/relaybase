"use client";

import { Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SETTINGS_UPDATE_PATH } from "@/console/lib/paths";
import { workerNeedsUpgrade } from "@/lib/dashboard/worker-version";
import {
  desktopCheckWorkerUpdate,
  isDesktopRuntime,
  type WorkerUpdateCheck,
} from "@/lib/desktop/bridge";
import { useOptionalAppUpdater } from "@/lib/desktop/updater/AppUpdaterContext";
import { useDesktop } from "@/lib/desktop/shell";

const DISMISS_KEY = "relaybase.worker-update-banner.dismissed";

export function WorkerUpdateBanner() {
  const { credentials, teamLogin } = useDesktop();
  const updater = useOptionalAppUpdater();
  const [check, setCheck] = useState<WorkerUpdateCheck | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissedVersion(sessionStorage.getItem(DISMISS_KEY));
  }, []);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    if (teamLogin) return;
    if (!credentials?.workerUrl?.trim()) {
      return;
    }
    let active = true;
    setLoading(true);
    void desktopCheckWorkerUpdate()
      .then((result) => {
        if (active) setCheck(result);
      })
      .catch(() => {
        if (active) setCheck(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [credentials?.workerUrl, credentials?.workerVersion, teamLogin]);

  const desktopVersion = updater?.currentVersion?.trim() || null;
  const updateAvailable = Boolean(
    check?.latestVersion &&
      workerNeedsUpgrade(
        check.currentVersion?.trim() || credentials?.workerVersion,
        check.latestVersion,
        desktopVersion,
      ),
  );

  if (teamLogin) return null;
  if (loading || !updateAvailable || !check) return null;
  if (dismissedVersion === check.latestVersion) return null;

  const current = check.currentVersion?.trim() || "unknown";

  return (
    <div className="shrink-0 px-2 pb-2">
      <Card size="sm" className="gap-2 py-2.5 shadow-none">
        <CardContent className="space-y-2 px-2.5">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[11px] leading-tight text-foreground">
              Worker update available{" "}
              <span className="font-mono">
                v{current} → v{check.latestVersion}
              </span>
            </p>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Dismiss Worker update banner"
              onClick={() => {
                sessionStorage.setItem(DISMISS_KEY, check.latestVersion);
                setDismissedVersion(check.latestVersion);
              }}
            >
              <X className="size-3" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={SETTINGS_UPDATE_PATH} />}
            className="h-7 w-full text-[11px]"
          >
            Update now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkerVersionSettingsCard() {
  const { credentials } = useDesktop();
  const updater = useOptionalAppUpdater();
  const [check, setCheck] = useState<WorkerUpdateCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = credentials?.workerVersion?.trim() || "unknown";
  const desktopVersion = updater?.currentVersion?.trim() || null;
  const checkedWorker = check?.currentVersion?.trim() || current;
  const latestVersion = check?.latestVersion?.trim() || null;
  const showUpdateWorker = Boolean(
    check &&
      latestVersion &&
      desktopVersion &&
      workerNeedsUpgrade(
        checkedWorker === "unknown" ? null : checkedWorker,
        latestVersion,
        desktopVersion,
      ),
  );

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await desktopCheckWorkerUpdate();
      setCheck(result);
      const workerVersion = result.currentVersion?.trim() || current;
      const needs = workerNeedsUpgrade(
        workerVersion === "unknown" ? null : workerVersion,
        result.latestVersion,
        desktopVersion,
      );
      if (!needs) {
        setMessage(`Worker v${result.latestVersion} is up to date.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check for updates");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">Worker version</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pre-built bundle deployed to your Cloudflare account. Matches the
          desktop app version after both are updated.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Installed
          </p>
          <p className="font-mono text-sm">v{current}</p>
        </div>
        {showUpdateWorker && latestVersion ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Available
            </p>
            <p className="font-mono text-sm text-amber-700 dark:text-amber-400">
              v{latestVersion}
            </p>
          </div>
        ) : null}
      </div>
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={checking}
          onClick={() => void handleCheck()}
        >
          {checking ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Check for updates
        </Button>
        {showUpdateWorker && latestVersion ? (
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/settings/worker/update" />}
          >
            Update Worker to v{latestVersion}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
