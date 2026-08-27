"use client";

import type { ReactNode } from "react";

import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

type DesktopTitleBarProps = {
  children?: ReactNode;
  className?: string;
  /** Interactive controls that must remain clickable (no-drag). */
  end?: ReactNode;
};

/**
 * Top chrome strip: window drag region on Tauri, select-none always.
 * Use for page headers / toolbars so the window can be moved by dragging.
 */
export function DesktopTitleBar({
  children,
  className,
  end,
}: DesktopTitleBarProps) {
  const { dragRegionClassName, dragRegionProps, noDragClassName, isDesktop } =
    useDesktopChrome();

  return (
    <header
      {...dragRegionProps}
      className={cn(
        "flex shrink-0 select-none items-center gap-3",
        dragRegionClassName,
        className,
      )}
    >
      <div
        {...dragRegionProps}
        className={cn("min-w-0 flex-1", dragRegionClassName)}
      >
        {children}
      </div>
      {end ? (
        <div
          className={cn("flex shrink-0 items-center gap-2", noDragClassName)}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          {end}
        </div>
      ) : null}
    </header>
  );
}
