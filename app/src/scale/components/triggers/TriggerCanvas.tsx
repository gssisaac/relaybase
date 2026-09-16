"use client";

import { TriggerNodeCard } from "@/scale/components/triggers/nodes/TriggerNodeCard";
import { TemplateNodeCard } from "@/scale/components/triggers/nodes/TemplateNodeCard";
import { WorkflowConnector } from "@/scale/components/triggers/nodes/WorkflowConnector";
import type { Trigger } from "@/lib/scale/api";
import { cn } from "@/lib/utils";

export type TriggerCanvasSelection = "trigger" | "template" | null;

export function TriggerCanvas({
  triggerId,
  trigger,
  templateName,
  selected,
  onSelect,
  onClearSelection,
  onPreview,
}: {
  triggerId: string;
  trigger: Trigger;
  templateName: string | null;
  selected: TriggerCanvasSelection;
  onSelect: (node: Exclude<TriggerCanvasSelection, null>) => void;
  onClearSelection: () => void;
  onPreview: () => void;
}) {
  const flowActive = trigger.status === "active";

  return (
    <div
      className={cn(
        "relative min-h-0 min-w-0 flex-1 overflow-auto",
        "bg-[radial-gradient(circle,_rgb(148_163_184/0.35)_1px,_transparent_1px)] [background-size:18px_18px]",
        "dark:bg-[radial-gradient(circle,_rgb(63_63_70/0.5)_1px,_transparent_1px)]",
      )}
      onClick={() => onClearSelection()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClearSelection();
      }}
      role="presentation"
    >
      <div className="flex min-h-full min-w-max items-center justify-center p-8 sm:p-12">
        <div className="flex items-center">
          <TriggerNodeCard
            trigger={trigger}
            selected={selected === "trigger"}
            flowActive={flowActive}
            onSelect={() => onSelect("trigger")}
          />
          <WorkflowConnector active={flowActive} />
          <TemplateNodeCard
            triggerId={triggerId}
            trigger={trigger}
            templateName={templateName}
            selected={selected === "template"}
            flowActive={flowActive}
            onSelect={() => onSelect("template")}
            onPreview={() => {
              onSelect("template");
              onPreview();
            }}
          />
        </div>
      </div>
    </div>
  );
}
