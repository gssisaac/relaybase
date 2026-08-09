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

    // Suppress WKWebView / system “Open Link / Inspect Element” menus.
    // Custom ContextMenu components still receive the event and can open.
    const onContextMenu = (event: Event) => {
      if (!desktop) return;
      event.preventDefault();
    };
    if (desktop) {
      document.addEventListener("contextmenu", onContextMenu);
    }

    return () => {
      root.classList.remove("relaybase-desktop", "relaybase-desktop-mac");
      document.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  return children;
}
