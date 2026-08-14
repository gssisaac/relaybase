"use client";

import { useEffect } from "react";

import { useOpenSettings } from "@/lib/navigation/open-settings";

/**
 * App-level keyboard shortcuts (capture phase).
 *
 * - `Meta+,` / `Ctrl+,` → open settings for the current sidebar mode.
 *
 * Mounted in `DashboardShell` alongside `GlobalCommandPalette`. Kept separate
 * from the mail command system (which is mail-action only) so the mail
 * registry stays untouched.
 */
export function AppHotkeys() {
  const openSettings = useOpenSettings();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;
      if (event.key !== ",") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openSettings();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [openSettings]);

  return null;
}
