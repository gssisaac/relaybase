"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageLoadingOverlay({
  loading,
  children,
  className,
}: {
  loading: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      {children}
      {loading ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2
            className="size-8 animate-spin text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">Loading</span>
        </div>
      ) : null}
    </div>
  );
}
