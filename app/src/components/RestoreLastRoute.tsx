"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { resolveEntryPath } from "@/email/sidebar-mode";

function readCookieUserId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)relaybase_user=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

/**
 * Client entry gate: restore the last email/dashboard route from localStorage.
 * Used on `/` (and desktop static home) so server redirects never wipe memory.
 */
export function RestoreLastRoute({
  userId,
  fallbackUserId = "desktop",
}: {
  /** Cookie session id when known on the server. */
  userId?: string;
  /** Desktop static export / no cookie. */
  fallbackUserId?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = userId?.trim() || readCookieUserId() || fallbackUserId;
    router.replace(resolveEntryPath(id));
  }, [router, userId, fallbackUserId]);

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
