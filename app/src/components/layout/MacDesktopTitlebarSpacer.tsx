"use client";

import { cn } from "@/lib/utils";
import { useDesktopChrome } from "@/lib/desktop/shell";

/**
 * Reserves the macOS Tauri overlay-title-bar / traffic-light space at the top
 * of a column that sits at the window's left edge (e.g. a fullscreen settings
 * side area). Mirrors the 28px spacer used by the setup layout and the main
 * sidebar's traffic-light clearance. Renders nothing on web / non-Mac.
 */
export function MacDesktopTitlebarSpacer({
  className,
}: {
  className?: string;
}) {
  const { isDesktop, isMacOS } = useDesktopChrome();
  if (!(isDesktop && isMacOS)) return null;
  return (
    <div
      aria-hidden
      className={cn("w-full shrink-0", className)}
      style={{ height: 28 }}
    />
  );
}
