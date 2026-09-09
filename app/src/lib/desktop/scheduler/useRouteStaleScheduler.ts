"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

const DEFAULT_STARTUP_DELAY_MS = 8_000;
/** Idle safety net for sessions that never navigate. */
const DEFAULT_PERIODIC_MS = 24 * 60 * 60 * 1000;

export type RouteStaleSchedulerOptions = {
  /** Whether auto checks should run at all right now (runtime/build gates). */
  enabled: () => boolean;
  /** True while a check (or the thing it triggers) is already in flight. */
  isBusy: () => boolean;
  /** Perform the check. Only called when enabled, idle, and stale. */
  check: () => void | Promise<void>;
  /** Minimum interval between auto checks (route change / idle timer). */
  staleMs: number;
  /** Delay before the first automatic check after mount. */
  startupDelayMs?: number;
  /** Idle safety net for sessions that sit on one screen and never navigate. */
  periodicMs?: number;
};

export type RouteStaleScheduler = {
  /** Reset the staleness clock — call when a manual check starts too. */
  markChecked: () => void;
  /** Run `check` now if enabled, idle, and stale; no-op otherwise. */
  ensureFresh: () => void;
};

/**
 * Drives a "recheck when stale" scheduler off two triggers: an idle safety
 * net (startup delay + slow periodic timer) and route changes (entering a
 * screen / navigating). Both funnel through the same staleness gate, so a
 * manual check via `markChecked` resets the clock for both.
 */
export function useRouteStaleScheduler({
  enabled,
  isBusy,
  check,
  staleMs,
  startupDelayMs = DEFAULT_STARTUP_DELAY_MS,
  periodicMs = DEFAULT_PERIODIC_MS,
}: RouteStaleSchedulerOptions): RouteStaleScheduler {
  const lastCheckedAtRef = useRef(0);

  const markChecked = useCallback(() => {
    lastCheckedAtRef.current = Date.now();
  }, []);

  const ensureFresh = useCallback(() => {
    if (!enabled() || isBusy()) return;
    if (
      lastCheckedAtRef.current !== 0 &&
      Date.now() - lastCheckedAtRef.current < staleMs
    ) {
      return;
    }
    markChecked();
    void check();
  }, [enabled, isBusy, check, staleMs, markChecked]);

  // Idle safety net for sessions that never trigger the route effect below.
  useEffect(() => {
    if (!enabled()) return;
    const startupTimeout = setTimeout(ensureFresh, startupDelayMs);
    const periodicId = setInterval(ensureFresh, periodicMs);
    return () => {
      clearTimeout(startupTimeout);
      clearInterval(periodicId);
    };
  }, [enabled, ensureFresh, startupDelayMs, periodicMs]);

  // Console entry / route change, gated by staleMs. Initial mount is left
  // to the startup timer above so both don't fire back to back.
  const pathname = usePathname();
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    ensureFresh();
  }, [pathname, ensureFresh]);

  return useMemo(
    () => ({ markChecked, ensureFresh }),
    [markChecked, ensureFresh],
  );
}
