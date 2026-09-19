"use client";

import { cn } from "@/lib/utils";

const PORT_SIZE_PX = 12;

/** Anchor dot centered on the node shell border (must sit on `relative overflow-visible` shell). */
export function WorkflowPort({
  side,
  active,
}: {
  side: "input" | "output";
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1/2 z-30 rounded-full border-2 border-background",
        active ? "bg-primary" : "bg-muted-foreground/50",
        side === "output" ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2",
        "-translate-y-1/2",
      )}
      style={{ width: PORT_SIZE_PX, height: PORT_SIZE_PX }}
      aria-hidden
    />
  );
}

export const WORKFLOW_PORT_RADIUS_PX = PORT_SIZE_PX / 2;
