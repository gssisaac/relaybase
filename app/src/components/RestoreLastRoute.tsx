"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_DASHBOARD_PATH,
  normalizeEntryPath,
  resolveEntryPathAsync,
} from "@/email/sidebar-mode";

/**
 * Client entry gate: restore the last email/dashboard route from ~/.relaybase
 * (desktop) with localStorage as a mirror.
 * Used on `/` (and desktop static home) so server redirects never wipe memory.
 */
export function RestoreLastRoute({
  userId,
  fallbackUserId = "desktop",
}: {
  /** Local operator id (always "desktop"). */
  userId?: string;
  fallbackUserId?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = userId?.trim() || fallbackUserId;
    let cancelled = false;
    const failSafe = window.setTimeout(() => {
      if (!cancelled) router.replace(DEFAULT_DASHBOARD_PATH);
    }, 6000);
    void resolveEntryPathAsync(id)
      .then((path) => {
        if (cancelled) return;
        router.replace(normalizeEntryPath(path));
      })
      .catch(() => {
        if (!cancelled) router.replace(DEFAULT_DASHBOARD_PATH);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
    };
  }, [router, userId, fallbackUserId]);

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
