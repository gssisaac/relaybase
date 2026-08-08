"use client";

import { useEffect, useState } from "react";

import { isDesktopRuntime } from "@/lib/desktop/bridge";
import {
  dragRegionDataAttribute,
  onDragRegionMouseDown,
} from "@/lib/desktop/window-drag";
import { cn } from "@/lib/utils";

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

function readDesktopFlags() {
  if (typeof window === "undefined") {
    return { isDesktop: false, isMacOS: false };
  }

  return {
    isDesktop: isDesktopRuntime(),
    isMacOS: isMacOSRuntime(),
  };
}

export function useDesktopChrome() {
  // Always start false so SSR HTML matches the first client paint (Tauri
  // would otherwise hydrate with drag-region attrs the server never sent).
  const [{ isDesktop, isMacOS }, setFlags] = useState({
    isDesktop: false,
    isMacOS: false,
  });

  useEffect(() => {
    setFlags(readDesktopFlags());
  }, []);

  const dragRegionProps = isDesktop
    ? {
        ...dragRegionDataAttribute,
        onMouseDown: onDragRegionMouseDown,
      }
    : undefined;

  return {
    isDesktop,
    isMacOS,
    dragRegionClassName: isDesktop ? "relaybase-drag-region" : undefined,
    dragRegionProps,
    noDragClassName: isDesktop ? "relaybase-no-drag" : undefined,
    macSidebarHeaderClassName:
      isDesktop && isMacOS ? "relaybase-desktop-mac-sidebar-header" : undefined,
  };
}

export function desktopChromeClassNames(
  isDesktop: boolean,
  {
    drag = false,
    noDrag = false,
    macSidebarHeader = false,
    isMacOS = false,
  }: {
    drag?: boolean;
    noDrag?: boolean;
    macSidebarHeader?: boolean;
    isMacOS?: boolean;
  } = {},
) {
  return cn(
    drag && isDesktop && "relaybase-drag-region",
    noDrag && isDesktop && "relaybase-no-drag",
    macSidebarHeader &&
      isDesktop &&
      isMacOS &&
      "relaybase-desktop-mac-sidebar-header",
  );
}
