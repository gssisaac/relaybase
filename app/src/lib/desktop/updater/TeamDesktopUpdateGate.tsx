"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { teamWorkerFetch } from "@/lib/desktop/api/worker-api";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { useRouteStaleScheduler } from "@/lib/desktop/scheduler/useRouteStaleScheduler";
import { useDesktop } from "@/lib/desktop/shell";

import { useOptionalAppUpdater } from "./AppUpdaterContext";

/** Re-check on console entry / route change once a check is this stale. */
const STALE_CHECK_MS = 10 * 60 * 1000;

/**
 * Mailbox-mode (invited/team) desktop update gate.
 *
 * The Worker is the source of truth for "what desktop version am I compatible
 * with." For a team session, this controller fetches the connected Worker's
 * `/health`, reads its advertised `desktopVersion`, and pushes it into
 * `AppUpdaterContext` as the install ceiling via `setUpdateCeiling`. The
 * updater then refuses to auto- or manually install any release ahead of it
 * until the owner upgrades their Worker.
 *
 * Non-rendering (`return null`); mounted inside `AppUpdaterProvider` in
 * `AppProviders`. Clearing the ceiling to `null` the instant `teamLogin`
 * becomes falsy (sign-out / role switch) guarantees an owner session can
 * never inherit a stale team-session ceiling within the same running app
 * instance. A Worker that hasn't picked up `DESKTOP_VERSION` reports
 * `desktopVersion: "unknown"`, which `teamDesktopUpdateAllowed` treats as
 * "no cap" — fail open, never worse than today's zero gating.
 */
export function TeamDesktopUpdateGate() {
  const { teamLogin } = useDesktop();
  const updater = useOptionalAppUpdater();
  const [workerDesktopVersion, setWorkerDesktopVersion] = useState<
    string | null
  >(null);
  const busyRef = useRef(false);

  const runCheck = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      // `/health` is public and unauthenticated; teamWorkerFetch targets the
      // team session's own connected Worker automatically. If the session
      // isn't unlocked yet this throws — no-op and let the scheduler retry.
      const res = await teamWorkerFetch("/health");
      if (!res.ok) {
        setWorkerDesktopVersion(null);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        desktopVersion?: unknown;
      } | null;
      const raw =
        typeof data?.desktopVersion === "string"
          ? data.desktopVersion.trim()
          : "";
      setWorkerDesktopVersion(raw || null);
    } catch {
      // Fail soft — never crash the app over a missing ceiling; the updater's
      // fail-open default keeps today's behavior.
      setWorkerDesktopVersion(null);
    } finally {
      busyRef.current = false;
    }
  }, []);

  const enabled = useCallback(
    () => isDesktopRuntime() && Boolean(teamLogin?.workerUrl?.trim()),
    [teamLogin?.workerUrl],
  );

  useRouteStaleScheduler({
    enabled,
    isBusy: () => busyRef.current,
    check: runCheck,
    staleMs: STALE_CHECK_MS,
  });

  // Push the ceiling into the updater for team sessions; clear it the instant
  // we leave a team session so an owner session can never inherit a stale cap.
  useEffect(() => {
    updater?.setUpdateCeiling(teamLogin ? workerDesktopVersion : null);
  }, [updater, teamLogin, workerDesktopVersion]);

  return null;
}
