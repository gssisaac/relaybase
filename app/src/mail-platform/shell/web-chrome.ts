/**
 * Web shell chrome — no drag region, no title bar.
 *
 * Email mode (web-only) renders in a browser tab; there is no window
 * drag region or desktop title bar. This adapter returns empty props
 * so `useDesktopChrome`-style consumers render without Tauri attrs.
 */
import type { MailShellChrome } from "../types";

export function createWebChrome(): MailShellChrome {
  return {
    isDesktop: false,
    isMacOS: false,
    dragRegionProps: {},
    dragRegionClassName: "",
    noDragClassName: "",
  };
}
