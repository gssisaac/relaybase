/**
 * Desktop shell chrome — delegates to the existing `useDesktopChrome`.
 *
 * Console mode (desktop app) renders a window drag region and title bar.
 * This adapter wraps the existing hook so email UI code can stay
 * platform-agnostic. Must be called from a React component.
 */
import { useDesktopChrome } from "@/lib/desktop/shell";
import type { MailShellChrome } from "../types";

export function useDesktopChromeAdapter(): MailShellChrome {
  const { isDesktop, isMacOS, dragRegionProps, dragRegionClassName, noDragClassName } =
    useDesktopChrome();
  return {
    isDesktop,
    isMacOS,
    // dragRegionProps from useDesktopChrome is a union; cast to the
    // platform-agnostic record shape. Consumers spread these onto elements.
    dragRegionProps: (dragRegionProps ?? {}) as Record<string, string>,
    dragRegionClassName: dragRegionClassName ?? "",
    noDragClassName: noDragClassName ?? "",
  };
}
