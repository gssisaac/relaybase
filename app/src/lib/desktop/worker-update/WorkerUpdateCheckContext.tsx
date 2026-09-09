"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  desktopCheckWorkerUpdate,
  isDesktopRuntime,
  type WorkerUpdateCheck,
} from "@/lib/desktop/bridge";
import { useRouteStaleScheduler } from "@/lib/desktop/scheduler/useRouteStaleScheduler";
import { useDesktop } from "@/lib/desktop/shell";

/** Re-check on console entry / route change once a check is this stale. */
const STALE_CHECK_MS = 10 * 60 * 1000;

type WorkerUpdateCheckValue = {
  check: WorkerUpdateCheck | null;
  checking: boolean;
  error: string | null;
  /** Manual check (console Settings). */
  checkNow: () => Promise<void>;
};

const WorkerUpdateCheckContext =
  createContext<WorkerUpdateCheckValue | null>(null);

export function WorkerUpdateCheckProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { credentials, teamLogin } = useDesktop();
  const workerUrl = credentials?.workerUrl?.trim() || null;

  const [check, setCheck] = useState<WorkerUpdateCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const runCheck = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setChecking(true);
    setError(null);
    try {
      const result = await desktopCheckWorkerUpdate();
      setCheck(result);
    } catch (err) {
      setCheck(null);
      setError(
        err instanceof Error ? err.message : "Could not check for updates",
      );
    } finally {
      setChecking(false);
      busyRef.current = false;
    }
  }, []);

  const enabled = useCallback(
    () => isDesktopRuntime() && !teamLogin && Boolean(workerUrl),
    [teamLogin, workerUrl],
  );

  const scheduler = useRouteStaleScheduler({
    enabled,
    isBusy: () => busyRef.current,
    check: runCheck,
    staleMs: STALE_CHECK_MS,
  });

  // The connected Worker itself changed (fresh install / just updated) —
  // always re-check regardless of staleness.
  useEffect(() => {
    if (!enabled()) return;
    scheduler.markChecked();
    void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerUrl, credentials?.workerVersion, teamLogin]);

  const checkNow = useCallback(async () => {
    scheduler.markChecked();
    await runCheck();
  }, [scheduler, runCheck]);

  const value = useMemo(
    () => ({ check, checking, error, checkNow }),
    [check, checking, error, checkNow],
  );

  return (
    <WorkerUpdateCheckContext.Provider value={value}>
      {children}
    </WorkerUpdateCheckContext.Provider>
  );
}

export function useWorkerUpdateCheck(): WorkerUpdateCheckValue {
  const ctx = useContext(WorkerUpdateCheckContext);
  if (!ctx) {
    throw new Error(
      "useWorkerUpdateCheck must be used within WorkerUpdateCheckProvider",
    );
  }
  return ctx;
}
