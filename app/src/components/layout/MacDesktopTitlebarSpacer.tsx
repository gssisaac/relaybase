"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useDesktopChrome } from "@/lib/desktop/shell";

/** Traffic-light clearance for the overlay macOS title bar (Tauri). */
export const MAC_TITLEBAR_SPACER_PX = 40;
/** Horizontal inset so controls sit to the right of the traffic lights. */
export const MAC_TRAFFIC_LIGHT_INSET_PX = 78;

/**
 * Reserves the macOS Tauri overlay-title-bar / traffic-light space at the top
 * of a column that sits at the window's left edge. Pass children to place
 * chrome controls (history nav, sidebar toggle) in this band.
 */
export function MacDesktopTitlebarSpacer({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const { isDesktop, isMacOS } = useDesktopChrome();
  if (!(isDesktop && isMacOS)) return null;
  const hasControls = Boolean(children);
  return (
    <div
      aria-hidden={hasControls ? undefined : true}
      className={cn(
        "flex w-full shrink-0 items-end",
        hasControls && "justify-end pr-2",
        className,
      )}
      style={{
        height: hasControls ? MAC_TITLEBAR_SPACER_PX : 28,
        paddingLeft: hasControls ? MAC_TRAFFIC_LIGHT_INSET_PX : undefined,
      }}
    >
      {children}
    </div>
  );
}
