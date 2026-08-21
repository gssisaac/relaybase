"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Pull distance (px) required to fire a refresh. */
export const PULL_REFRESH_THRESHOLD = 56;
const MAX_PULL = 88;
const RELEASE_MS = 180;

/**
 * Desktop pull-to-refresh: at the top of a scroll container, wheel/trackpad
 * "down" (negative deltaY) accumulates a pull; crossing the threshold calls
 * `onRefresh`. Used by the mail list so scrolling down from the top reloads
 * inbox/sent from the Worker.
 */
export function usePullToRefresh(options: {
  enabled: boolean;
  refreshing: boolean;
  onRefresh?: () => void;
}) {
  const { enabled, refreshing, onRefresh } = options;
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const firedRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);

  const setPullBoth = useCallback((next: number) => {
    pullRef.current = next;
    setPull(next);
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!refreshing) {
      firedRef.current = false;
      setPullBoth(0);
    }
  }, [refreshing, setPullBoth]);

  useEffect(() => () => clearResetTimer(), [clearResetTimer]);

  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (event.currentTarget.scrollTop > 0 && pullRef.current > 0) {
        setPullBoth(0);
      }
    },
    [setPullBoth],
  );

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!enabled || !onRefresh || refreshing) return;
      const atTop = event.currentTarget.scrollTop <= 0;
      if (!atTop || event.deltaY >= 0) {
        if (pullRef.current > 0) setPullBoth(0);
        return;
      }
      event.preventDefault();
      const next = Math.min(
        MAX_PULL,
        pullRef.current + Math.abs(event.deltaY) * 0.45,
      );
      setPullBoth(next);
      if (next >= PULL_REFRESH_THRESHOLD && !firedRef.current) {
        firedRef.current = true;
        onRefresh();
      }
      clearResetTimer();
      resetTimerRef.current = window.setTimeout(() => {
        if (!firedRef.current) setPullBoth(0);
      }, RELEASE_MS);
    },
    [clearResetTimer, enabled, onRefresh, refreshing, setPullBoth],
  );

  return { pull, onScroll, onWheel };
}
