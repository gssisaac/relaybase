"use client";

import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import { cn } from "@/lib/utils";

/** Dashboard scroll body: centered column on desktop, full width in the browser. */
export function dashboardScrollBodyClassName(className?: string) {
  return cn(
    "w-full p-4",
    isDesktopRuntime() && "mx-auto max-w-[1200px]",
    className,
  );
}
