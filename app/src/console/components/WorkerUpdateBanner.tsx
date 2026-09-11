"use client";

import { Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SETTINGS_UPDATE_PATH, SETTINGS_WORKER_PROGRESS_PATH } from "@/console/lib/paths";
import { workerNeedsUpgrade } from "@/lib/dashboard/worker-version";
import { useOptionalAppUpdater } from "@/lib/desktop/updater/AppUpdaterContext";
import { useDesktop } from "@/lib/desktop/shell";
import { useWorkerUpdateCheck } from "@/lib/desktop/worker-update/WorkerUpdateCheckContext";
import { useWorkerUpdateRunner } from "@/lib/desktop/worker-update/WorkerUpdateRunnerContext";

/**
 * Already authorized with Cloudflare and the saved Worker still matches?
 * Skip the Approve screen and the URL-confirm dialog entirely and jump
 * straight to the (backgroundable) progress view. Otherwise fall back to
 * the Approve screen, which re-authorizes or explains an account mismatch.
 */
async function goUpdateWorker(
  router: ReturnType<typeof useRouter>,
  start: ReturnType<typeof useWorkerUpdateRunner>["start"],
) {
  const res = await start();
  if (res.ok) {
    router.push("/settings/worker/progress");
  } else {
    router.push("/settings/worker/update");
  }
}

const DISMISS_KEY = "relaybase.worker-update-banner.dismissed";

/** Sidebar status shown while a Worker update is actually running. */
function WorkerInstallingBanner() {
  const runner = useWorkerUpdateRunner();
  if (!runner.isInstalling) return null;
  return (
    <div className="shrink-0 px-2 pb-2">
      <Card size="sm" className="gap-2 py-2.5 shadow-none">
        <CardContent className="px-2.5">
          <Link
            href={SETTINGS_WORKER_PROGRESS_PATH}
            className="flex items-center gap-2 text-[11px] leading-tight text-foreground hover:underline"
          >
            <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {runner.phase === "checking" ? "Checking…" : "Installing Worker…"}
            </span>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkerUpdateBanner() {
  const { credentials, teamLogin } = useDesktop();
  const updater = useOptionalAppUpdater();
  const { check, checking } = useWorkerUpdateCheck();
  const runner = useWorkerUpdateRunner();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissedVersion(sessionStorage.getItem(DISMISS_KEY));
  }, []);

  // While an update is in flight, show the global installing status instead
  // of the "Update now" button — the run is managed by the runner store and
  // survives navigation, so the sidebar reflects live progress.
  if (runner.isInstalling) return <WorkerInstallingBanner />;

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
  if (checking || !updateAvailable || !check) return null;
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
  const router = useRouter();
  const { credentials } = useDesktop();
  const updater = useOptionalAppUpdater();
  const { start: startWorkerUpdate } = useWorkerUpdateRunner();
  const { check, checking, error, checkNow } = useWorkerUpdateCheck();
  const [starting, setStarting] = useState(false);

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
  const message =
    check && latestVersion && !showUpdateWorker
      ? `Worker v${latestVersion} is up to date.`
      : null;

  async function handleUpdateClick() {
    setStarting(true);
    try {
      await goUpdateWorker(router, startWorkerUpdate);
    } finally {
      setStarting(false);
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
          onClick={() => void checkNow()}
        >
          {checking ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Check for updates
        </Button>
        {showUpdateWorker && latestVersion ? (
          <Button
            type="button"
            size="sm"
            disabled={starting}
            onClick={() => void handleUpdateClick()}
          >
            {starting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Update Worker to v{latestVersion}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
