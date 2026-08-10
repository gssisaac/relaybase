"use client";

import { useEffect } from "react";

import { installZoomHotkeys } from "@/lib/zoomHotkeys";

/**
 * Installs Cmd/Ctrl + -/+/0 zoom hotkeys in the Tauri desktop runtime.
 * Trackpad pinch-zoom is blocked; keyboard-only. No-op on web.
 */
export function ZoomHotkeys() {
  useEffect(() => {
    installZoomHotkeys();
  }, []);

  return null;
}
