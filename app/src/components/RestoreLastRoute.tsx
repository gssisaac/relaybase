"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_EMAIL_PATH,
  resolveEntryPathAsync,
} from "@/email/sidebar-mode";

/**
 * Static desktop export only pre-renders mailbox section roots (not every
 * message id). Collapse deep links so restore never targets a missing HTML.
 */
function normalizeEntryPath(path: string): string {
  const [pathnamePart, query = ""] = path.split("?");
  const pathname = pathnamePart || "/";
  const qs = query ? `?${query}` : "";
  const emailSection = pathname.match(
    /^\/email\/(inbox|drafts|sent|compose|trash)(?:\/.*)?$/,
  );
  if (emailSection) {
    return `/email/${emailSection[1]}${qs}`;
  }
  if (pathname === "/email" || pathname.startsWith("/email/")) {
    return `${DEFAULT_EMAIL_PATH}${qs}`;
  }
  if (pathname === "/" || !pathname.startsWith("/")) {
    return DEFAULT_DASHBOARD_PATH;
  }
  return `${pathname}${qs}`;
}

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
