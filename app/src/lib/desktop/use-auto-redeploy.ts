"use client";

import * as React from "react";

import {
  desktopGetBundledWorkerVersion,
  desktopGetDeployedWorkerVersion,
  desktopGetDesktopSettings,
  type DesktopCredentials,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";
import { getWorkerDeployStore } from "@/lib/desktop/deploy-store";

function compareVersions(a: string, b: string): number {
  const pa = a.trim().split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.trim().split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

/**
 * On desktop startup, if the bundled Worker version is newer than the deployed
 * one and the user has not opted out, silently redeploy + run migrations.
 *
 * This is what makes the desktop app "drive server redeploy + migration on
 * update": after a self-update the bundled worker is newer, so on next launch
 * this hook redeploys it. Runs at most once per process.
 */
export function useAutoRedeployOnUpdate(
  isDesktop: boolean,
  ready: boolean,
  credentials: DesktopCredentials | null,
  onCompleted?: () => void,
) {
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (!isDesktop || !ready || ranRef.current) return;
    if (!credentials) return;
    const hasCf = Boolean(
      credentials.accountId?.trim() && credentials.apiToken?.trim(),
    );
    const hasWorker = Boolean(
      credentials.workerUrl?.trim() && credentials.adminToken?.trim(),
    );
    if (!hasCf || !hasWorker) return;

    ranRef.current = true;
    void (async () => {
      let settings;
      try {
        settings = await desktopGetDesktopSettings();
      } catch {
        return;
      }
      if (!settings.autoRedeployOnUpdate) return;

      let bundled: string;
      try {
        bundled = await desktopGetBundledWorkerVersion();
      } catch {
        return;
      }
      let deployed: string | null = null;
      try {
        const info = await desktopGetDeployedWorkerVersion(
          credentials.workerUrl.trim(),
          credentials.adminToken.trim(),
        );
        deployed = info.workerVersion || null;
      } catch {
        return; // can't reach worker — don't auto-deploy blind
      }
      if (!deployed || compareVersions(bundled, deployed) <= 0) return;

      const store = getWorkerDeployStore();
      if (store.busy) return;
      try {
        await store.deploy({
          enableD1Logs: settings.enableD1Logs,
          rotateAdminToken: false,
        });
        onCompleted?.();
      } catch {
        /* surfaced via store.error / log file */
      }
    })();
  }, [isDesktop, ready, credentials, onCompleted]);
}

export { isDesktopRuntime };
