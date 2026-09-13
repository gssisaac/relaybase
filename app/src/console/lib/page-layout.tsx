"use client";

import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Dashboard scroll body: centered column on desktop, full width in the browser. */
export function dashboardScrollBodyClassName(className?: string) {
  return cn(
    "w-full p-4",
    isDesktopRuntime() && "mx-auto max-w-[1200px]",
    className,
  );
}

/** Horizontal scroll for wide dashboard tables on small screens. */
export function dashboardTableScrollClassName(className?: string) {
  return cn("w-full overflow-x-auto overscroll-x-contain", className);
}

export function DashboardTableScroll({
  children,
  className,
  minWidthClassName = "min-w-[640px]",
}: {
  children: ReactNode;
  className?: string;
  minWidthClassName?: string;
}) {
  return (
    <div className={dashboardTableScrollClassName(className)}>
      <div className={minWidthClassName}>{children}</div>
    </div>
  );
}
