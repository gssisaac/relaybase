"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { TriggerCanvasSelection } from "@/studio/components/triggers/TriggerCanvas";
import { TriggerGeneralSettingsPanel } from "@/studio/pages/triggers/TriggerGeneralSettingsPanel";
import {
  TriggerOutboundSenderPanel,
  type OutboundSenderDraft,
} from "@/studio/pages/triggers/TriggerOutboundSenderPanel";
import { TriggerSourceSection } from "@/studio/pages/triggers/TriggerSourceSection";
import { useTriggerConfigUiRequired } from "@/studio/pages/triggers/TriggerConfigUiContext";
import { useTriggerDetail } from "@/studio/pages/triggers/TriggerDetailContext";
import { TRIGGER_CONFIG_INSPECTOR_WIDTH_PX } from "@/studio/lib/triggers/trigger-config-inspector";
import { cn } from "@/lib/utils";

function inspectorTitle(selection: TriggerCanvasSelection): string {
  if (selection === "trigger") return "Trigger";
  if (selection === "template") return "Outbound sender";
  return "General settings";
}

export function TriggerConfigInspector({ selection }: { selection: TriggerCanvasSelection }) {
  const { trigger } = useTriggerDetail();
  const { inspectorOpen, closeInspector } = useTriggerConfigUiRequired();
  const [senderDraft, setSenderDraft] = useState<OutboundSenderDraft>({
    fromName: null,
    fromEmail: null,
    replyTo: null,
  });

  useEffect(() => {
    if (!trigger) return;
    setSenderDraft({
      fromName: trigger.fromName ?? null,
      fromEmail: trigger.fromEmail ?? null,
      replyTo: trigger.replyTo ?? null,
    });
  }, [trigger?.id, trigger?.fromName, trigger?.fromEmail, trigger?.replyTo, trigger]);

  if (!trigger) return null;

  const editable = trigger.listStatus !== "archived";

  return (
    <div
      className="flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out"
      style={{ width: inspectorOpen ? TRIGGER_CONFIG_INSPECTOR_WIDTH_PX : 0 }}
      aria-hidden={!inspectorOpen}
    >
      <aside
        className={cn(
          "flex h-full flex-col border-y border-l border-border bg-background",
          "rounded-tl-3xl rounded-bl-3xl",
          !inspectorOpen && "pointer-events-none opacity-0",
        )}
        style={{ width: TRIGGER_CONFIG_INSPECTOR_WIDTH_PX }}
        aria-label="Trigger settings"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">{inspectorTitle(selection)}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {selection === "trigger"
                ? "Source, cooldown, and activation."
                : selection === "template"
                  ? "From address shown on sent mail."
                  : "Name, purpose, and lifecycle."}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label="Close settings panel"
            onClick={closeInspector}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {selection === "trigger" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              <TriggerSourceSection embedded />
            </div>
          ) : null}
          {selection === "template" ? (
            <TriggerOutboundSenderPanel
              embedded
              draft={senderDraft}
              disabled={!editable}
              onDraftChange={(patch) => setSenderDraft((prev) => ({ ...prev, ...patch }))}
            />
          ) : null}
          {selection === null ? <TriggerGeneralSettingsPanel /> : null}
        </div>
      </aside>
    </div>
  );
}
