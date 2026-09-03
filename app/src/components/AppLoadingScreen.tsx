"use client";

import { Loader2 } from "lucide-react";

/**
 * Full-viewport wait: app icon + spinner.
 * Use for boot, last-route restore, and any other whole-window handoff.
 * Do not invent a second "Loading…" layout — see docs/desktop/app-loading-screen.md.
 */
export function AppLoadingScreen() {
  return (
    <div
      className="flex h-svh flex-col items-center justify-center gap-4 text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <img
        src="/icon.png"
        alt=""
        width={64}
        height={64}
        className="size-12"
      />
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  );
}
