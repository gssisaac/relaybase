"use client";

import { useLayoutEffect, type ReactNode } from "react";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

function isMacOSRuntime(): boolean {
  if (typeof navigator === "undefined") return false;

  const platform = navigator.platform ?? "";
  const userAgent = navigator.userAgent ?? "";
  const userAgentPlatform =
    "userAgentData" in navigator
      ? (navigator.userAgentData as { platform?: string } | undefined)?.platform ??
        ""
      : "";

  return (
    /Mac|iPhone|iPad|iPod/i.test(platform) ||
    /Mac OS X/i.test(userAgent) ||
    userAgentPlatform === "macOS"
  );
}

/** Marks the document for Tauri chrome styles (select-none, drag regions). */
export function DesktopShell({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const desktop = isDesktopRuntime();
    const mac = isMacOSRuntime();

    root.classList.toggle("relaybase-desktop", desktop);
    root.classList.toggle("relaybase-desktop-mac", desktop && mac);

    return () => {
      root.classList.remove("relaybase-desktop", "relaybase-desktop-mac");
    };
  }, []);

  return children;
}
