"use client";

import { useEffect, useMemo, useState } from "react";

import {
  desktopCheckWorkerUpdate,
  isDesktopRuntime,
  type WorkerUpdateCheck,
} from "@/lib/desktop/bridge";
import { workerNeedsUpgrade, desktopBehindRelease } from "@/lib/dashboard/worker-version";
import { useOptionalAppUpdater } from "@/lib/desktop/updater/AppUpdaterContext";
import { useDesktop } from "@/lib/desktop/shell";

export type ProductUpdateStatus = {
  loading: boolean;
  desktopUpdateAvailable: boolean;
  workerUpdateAvailable: boolean;
  anyUpdateAvailable: boolean;
  /** Desktop must reach latest before Worker can update. */
  desktopBlocksWorker: boolean;
  workerCheck: WorkerUpdateCheck | null;
};

export function useProductUpdateStatus(): ProductUpdateStatus {
  const updater = useOptionalAppUpdater();
  const { credentials, teamLogin } = useDesktop();
  const [workerCheck, setWorkerCheck] = useState<WorkerUpdateCheck | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isDesktopRuntime() || teamLogin) return;
    if (!credentials?.workerUrl?.trim()) return;

    let active = true;
    setLoading(true);
    void desktopCheckWorkerUpdate()
      .then((result) => {
        if (active) setWorkerCheck(result);
      })
      .catch(() => {
        if (active) setWorkerCheck(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [credentials?.workerUrl, credentials?.workerVersion, teamLogin]);

  return useMemo(() => {
    const desktopVersion = updater?.currentVersion?.trim() || null;
    const latestVersion = workerCheck?.latestVersion?.trim() || null;
    const workerCurrent =
      workerCheck?.currentVersion?.trim() ||
      credentials?.workerVersion?.trim() ||
      null;

    const desktopUpdateAvailable = Boolean(
      updater &&
        updater.version &&
        (updater.phase === "available" ||
          updater.phase === "downloading" ||
          updater.phase === "ready"),
    );

    const desktopBlocksWorker = Boolean(
      desktopUpdateAvailable ||
        desktopBehindRelease(desktopVersion, latestVersion),
    );

    const workerUpdateAvailable =
      !teamLogin &&
      Boolean(
        latestVersion &&
          workerNeedsUpgrade(workerCurrent, latestVersion, desktopVersion),
      );

    return {
      loading,
      desktopUpdateAvailable,
      workerUpdateAvailable,
      anyUpdateAvailable: desktopUpdateAvailable || workerUpdateAvailable,
      desktopBlocksWorker,
      workerCheck,
    };
  }, [
    credentials?.workerVersion,
    loading,
    teamLogin,
    updater,
    workerCheck,
  ]);
}
