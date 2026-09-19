"use client";

import { cn } from "@/lib/utils";

/** Placeholder while a message-template thumbnail is generating. */
export function TemplateWireframe({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none flex aspect-[640/452] w-full flex-col overflow-hidden rounded border border-border/80 bg-muted/25 p-3",
        className,
      )}
      aria-hidden
    >
      <div className="mb-2 h-2 w-1/3 rounded bg-muted-foreground/20" />
      <div className="space-y-1.5 flex-1">
        <div className="h-1.5 w-full rounded bg-muted-foreground/18" />
        <div className="h-1.5 w-[92%] rounded bg-muted-foreground/14" />
        <div className="h-1.5 w-[78%] rounded bg-muted-foreground/12" />
        <div className="h-1.5 w-[85%] rounded bg-muted-foreground/10" />
      </div>
      <div className="mt-2 h-2 w-1/4 rounded bg-primary/20" />
    </div>
  );
}
