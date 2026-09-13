"use client";

import type { ReactNode } from "react";

import { useDesktopChrome } from "@/lib/desktop/shell";
import { MobileNavTrigger } from "@/components/layout/MobileNavTrigger";
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
        className={cn("flex min-w-0 flex-1 items-center gap-2", dragRegionClassName)}
      >
        <MobileNavTrigger />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {end ? (
        <div
          className={cn("flex shrink-0 flex-wrap items-center justify-end gap-2", noDragClassName)}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          {end}
        </div>
      ) : null}
    </header>
  );
}
