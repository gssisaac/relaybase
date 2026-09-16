"use client";

import { cn } from "@/lib/utils";
import { WORKFLOW_PORT_RADIUS_PX } from "@/scale/components/triggers/nodes/WorkflowPort";

const CONNECTOR_WIDTH = 72;

export function WorkflowConnector({ active }: { active?: boolean }) {
  const span = CONNECTOR_WIDTH + WORKFLOW_PORT_RADIUS_PX * 2;

  return (
    <div
      className={cn(
        "relative shrink-0 self-center",
        active ? "text-primary" : "text-muted-foreground/50",
      )}
      style={{ width: span, height: WORKFLOW_PORT_RADIUS_PX * 2 }}
      aria-hidden
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${span} ${WORKFLOW_PORT_RADIUS_PX * 2}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1={WORKFLOW_PORT_RADIUS_PX}
          y1={WORKFLOW_PORT_RADIUS_PX}
          x2={span - WORKFLOW_PORT_RADIUS_PX - 5}
          y2={WORKFLOW_PORT_RADIUS_PX}
          stroke="currentColor"
          strokeWidth={2}
          strokeDasharray={active ? "6 5" : "5 5"}
          strokeLinecap="round"
        />
        <path
          d={`M ${span - WORKFLOW_PORT_RADIUS_PX} ${WORKFLOW_PORT_RADIUS_PX} L ${span - WORKFLOW_PORT_RADIUS_PX - 7} ${WORKFLOW_PORT_RADIUS_PX - 3} L ${span - WORKFLOW_PORT_RADIUS_PX - 7} ${WORKFLOW_PORT_RADIUS_PX + 3} Z`}
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
