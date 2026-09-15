"use client";

import { cn } from "@/lib/utils";

export function LayoutWireframe({
  variant,
  className,
}: {
  variant: "minimal" | "header" | "card" | "plain";
  className?: string;
}) {
  if (variant === "plain") {
    return (
      <div className={cn("pointer-events-none px-0.5", className)} aria-hidden>
        <div className="space-y-1.5">
          <div className="h-1 w-full rounded bg-muted-foreground/25" />
          <div className="h-1 w-[92%] rounded bg-muted-foreground/20" />
          <div className="h-1 w-[75%] rounded bg-muted-foreground/15" />
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "pointer-events-none overflow-hidden rounded border border-border/80 bg-muted/30",
        variant === "card" && "p-1",
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          "rounded-sm bg-background p-2",
          variant === "card" && "border border-border/60",
        )}
      >
        {variant === "header" ? (
          <div className="mb-1.5 flex items-center gap-1">
            <div className="size-2.5 shrink-0 rounded-sm bg-muted-foreground/25" />
            <div className="h-1 flex-1 rounded-sm bg-muted-foreground/20" />
          </div>
        ) : null}
        <div className="space-y-1">
          <div className="h-1 w-full rounded bg-muted-foreground/20" />
          <div className="h-1 w-[80%] rounded bg-muted-foreground/15" />
          <div className="h-1 w-[60%] rounded bg-muted-foreground/10" />
        </div>
      </div>
    </div>
  );
}
