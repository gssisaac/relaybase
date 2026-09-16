"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { TriggerNodeCard } from "@/studio/components/triggers/nodes/TriggerNodeCard";
import { MessageNodeCard } from "@/studio/components/triggers/nodes/MessageNodeCard";
import { WorkflowConnector } from "@/studio/components/triggers/nodes/WorkflowConnector";
import type { Trigger } from "@/lib/studio/api";
import { TRIGGER_CONFIG_INSPECTOR_WIDTH_PX } from "@/studio/lib/triggers/trigger-config-inspector";
import { useTriggerConfigUi } from "@/studio/pages/triggers/TriggerConfigUiContext";
import { cn } from "@/lib/utils";

export type TriggerCanvasSelection = "trigger" | "template" | null;

const MIN_CANVAS_SCALE = 0.72;
const CANVAS_PAD = 48;

type CanvasFit = {
  scale: number;
  contentWidth: number;
  contentHeight: number;
};

function computeCanvasFit(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
): CanvasFit {
  if (viewportWidth <= 0 || contentWidth <= 0) {
    return { scale: 1, contentWidth, contentHeight };
  }

  let scale = 1;

  if (contentWidth + CANVAS_PAD * 2 > viewportWidth) {
    scale = Math.min(scale, (viewportWidth - CANVAS_PAD * 2) / contentWidth);
  }
  if (viewportHeight > 0 && contentHeight + CANVAS_PAD * 2 > viewportHeight) {
    scale = Math.min(scale, (viewportHeight - CANVAS_PAD * 2) / contentHeight);
  }

  scale = Math.max(MIN_CANVAS_SCALE, Math.min(1, scale));

  return { scale, contentWidth, contentHeight };
}

/** Canvas width once the inspector width transition has finished. */
function targetCanvasWidth(rowWidth: number, inspectorOpen: boolean): number {
  return Math.max(0, rowWidth - (inspectorOpen ? TRIGGER_CONFIG_INSPECTOR_WIDTH_PX : 0));
}

export function TriggerCanvas({
  triggerId,
  trigger,
  messageName,
  selected,
  onSelect,
  onClearSelection,
  onPreview,
}: {
  triggerId: string;
  trigger: Trigger;
  messageName: string | null;
  selected: TriggerCanvasSelection;
  onSelect: (node: Exclude<TriggerCanvasSelection, null>) => void;
  onClearSelection: () => void;
  onPreview: () => void;
}) {
  const flowActive = trigger.status === "active";
  const inspectorOpen = useTriggerConfigUi()?.inspectorOpen ?? false;

  const viewportRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<CanvasFit>({
    scale: 1,
    contentWidth: 0,
    contentHeight: 0,
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const flow = flowRef.current;
    if (!viewport || !flow) return;

    const row = viewport.parentElement;

    const update = () => {
      const contentWidth = flow.offsetWidth;
      const contentHeight = flow.offsetHeight;
      const rowWidth = row?.clientWidth ?? viewport.clientWidth;
      // Opening: snap scale to the post-transition width so it does not chase the
      // shrinking flex column. Closing: follow the live canvas width as it expands.
      const fitWidth = inspectorOpen
        ? targetCanvasWidth(rowWidth, true)
        : viewport.clientWidth;

      setFit(
        computeCanvasFit(
          fitWidth,
          viewport.clientHeight,
          contentWidth,
          contentHeight,
        ),
      );
    };

    update();
    const ro = new ResizeObserver(update);
    if (row) ro.observe(row);
    ro.observe(flow);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [inspectorOpen, triggerId, messageName, trigger.status, trigger.name]);

  const scaledWidth = fit.contentWidth * fit.scale;
  const scaledHeight = fit.contentHeight * fit.scale;

  return (
    <div
      ref={viewportRef}
      className={cn(
        "relative min-h-0 min-w-0 flex-1 overflow-hidden",
        "bg-[radial-gradient(circle,_rgb(148_163_184/0.35)_1px,_transparent_1px)] [background-size:18px_18px]",
        "dark:bg-[radial-gradient(circle,_rgb(63_63_70/0.5)_1px,_transparent_1px)]",
      )}
      onClick={() => onClearSelection()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClearSelection();
      }}
      role="presentation"
    >
      <div className="flex min-h-full min-w-full items-center justify-center px-12 py-8 sm:px-14 sm:py-12">
        <div
          className="relative shrink-0"
          style={{
            width: scaledWidth > 0 ? scaledWidth : undefined,
            height: scaledHeight > 0 ? scaledHeight : undefined,
          }}
        >
          <div
            ref={flowRef}
            className="absolute left-0 top-0 flex origin-top-left items-center"
            style={{
              transform: `scale(${fit.scale})`,
              width: fit.contentWidth > 0 ? fit.contentWidth : undefined,
            }}
          >
            <TriggerNodeCard
              trigger={trigger}
              selected={selected === "trigger"}
              flowActive={flowActive}
              onSelect={() => onSelect("trigger")}
            />
            <WorkflowConnector active={flowActive} />
            <MessageNodeCard
              triggerId={triggerId}
              trigger={trigger}
              messageName={messageName}
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
    </div>
  );
}
