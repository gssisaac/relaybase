"use client";

import { Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  desktopCheckWorkerUpdate,
  desktopUpdateInstalledWorker,
  isDesktopRuntime,
  type WorkerUpdateCheck,
} from "@/lib/desktop/bridge";
import { useDesktop } from "@/lib/desktop/DesktopContext";

const DISMISS_KEY = "relaybase.worker-update-banner.dismissed";

export function WorkerUpdateBanner() {
  const { credentials, teamLogin } = useDesktop();
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
    if (!credentials?.workerUrl?.trim() || !credentials.adminToken?.trim()) {
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
  }, [credentials?.workerUrl, credentials?.adminToken, credentials?.workerVersion, teamLogin]);

  if (teamLogin) return null;
  if (loading || !check?.updateAvailable) return null;
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
            render={<Link href="/settings/worker" />}
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
  const { credentials, refresh } = useDesktop();
  const [check, setCheck] = useState<WorkerUpdateCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = credentials?.workerVersion?.trim() || "unknown";

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const result = await desktopCheckWorkerUpdate();
      setCheck(result);
      if (!result.updateAvailable) {
        setMessage(`Worker v${result.latestVersion} is up to date.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check for updates");
    } finally {
      setChecking(false);
    }
  }

  async function handleUpdate() {
    setUpdating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await desktopUpdateInstalledWorker(
        credentials?.serverToken?.trim() || undefined,
      );
      setMessage(`Worker updated to v${result.workerVersion || check?.latestVersion || "latest"}.`);
      setCheck(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Worker update failed");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">Worker version</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pre-built bundle deployed to your Cloudflare account. Check relaybase.xyz
          for newer releases.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Installed
          </p>
          <p className="font-mono text-sm">v{current}</p>
        </div>
        {check?.updateAvailable ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Available
            </p>
            <p className="font-mono text-sm text-amber-700 dark:text-amber-400">
              v{check.latestVersion}
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
          disabled={checking || updating}
          onClick={() => void handleCheck()}
        >
          {checking ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Check for updates
        </Button>
        {check?.updateAvailable ? (
          <Button
            type="button"
            size="sm"
            disabled={updating || checking}
            onClick={() => void handleUpdate()}
          >
            {updating ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Update Worker to v{check.latestVersion}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
