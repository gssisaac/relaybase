import { getCurrentWebview } from "@tauri-apps/api/webview";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

const MAX_ZOOM_LEVEL = 10;
const MIN_ZOOM_LEVEL = 0.2;
const ZOOM_STEP = 0.2;

/** Cmd on macOS, Ctrl elsewhere — matches Tauri's former zoom polyfill. */
function isZoomModifier(event: KeyboardEvent | WheelEvent): boolean {
  const isMac =
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad|ipod/i.test(navigator.platform);
  return isMac ? event.metaKey : event.ctrlKey;
}

/**
 * Keyboard-only page zoom (Cmd/Ctrl + -/+/0).
 * Pinch-zoom and Ctrl/Cmd+wheel are blocked — Tauri's built-in zoom polyfill
 * treats trackpad pinch as Ctrl+wheel, so we own hotkeys ourselves instead.
 * No-op outside the Tauri desktop runtime.
 */
export function installZoomHotkeys(): void {
  if (typeof window === "undefined" || !isDesktopRuntime()) return;

  let zoomLevel = 1;
  const webview = getCurrentWebview();

  const applyZoom = (next: number) => {
    zoomLevel = Math.min(Math.max(next, MIN_ZOOM_LEVEL), MAX_ZOOM_LEVEL);
    void webview.setZoom(zoomLevel);
  };

  window.addEventListener("keydown", (event) => {
    if (!isZoomModifier(event)) return;

    if (event.key === "-") {
      event.preventDefault();
      applyZoom(zoomLevel - ZOOM_STEP);
    } else if (event.key === "=" || event.key === "+") {
      event.preventDefault();
      applyZoom(zoomLevel + ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      applyZoom(1);
    }
  });

  // macOS pinch-to-zoom is delivered as wheel events with ctrlKey set.
  const blockGestureZoom = (event: Event) => {
    const wheel = event as WheelEvent;
    if (wheel.ctrlKey || wheel.metaKey) {
      event.preventDefault();
    }
  };

  window.addEventListener("wheel", blockGestureZoom, {
    passive: false,
    capture: true,
  });
  // Legacy name still used by some WebKit paths.
  window.addEventListener("mousewheel", blockGestureZoom, {
    passive: false,
    capture: true,
  });

  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener("gesturechange", (event) => event.preventDefault());
}
