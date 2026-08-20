"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { modeFromPathname } from "@/email/sidebar-mode";
import { useEmailPaths } from "@/email/lib/paths";
import { settingsTabHref } from "@/console/lib/paths";

/**
 * Navigate to the settings page for the current sidebar mode:
 * - email mode    → /email/settings (preserving ?account= / ?from= if present)
 * - dashboard mode → /settings
 *
 * Shared by the `Meta+,` hotkey and the Cmd+K "Go to settings" command so the
 * URL logic lives in one place.
 */
export function useOpenSettings(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { settings: emailSettingsHref } = useEmailPaths();

  const href = useMemo(() => {
    const mode = modeFromPathname(pathname);
    if (mode === "email") {
      const account =
        searchParams.get("account")?.trim() ||
        searchParams.get("from")?.trim() ||
        null;
      return account
        ? `${emailSettingsHref}?account=${encodeURIComponent(account)}`
        : emailSettingsHref;
    }
    return settingsTabHref("cloudflare");
  }, [pathname, searchParams, emailSettingsHref]);

  return useCallback(() => {
    router.push(href);
  }, [router, href]);
}
