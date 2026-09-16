"use client";

import { useEffect, useState } from "react";

import type { TriggerCanvasSelection } from "@/scale/components/triggers/TriggerCanvas";
import { TriggerGeneralSettingsPanel } from "@/scale/pages/triggers/TriggerGeneralSettingsPanel";
import {
  TriggerOutboundSenderPanel,
  type OutboundSenderDraft,
} from "@/scale/pages/triggers/TriggerOutboundSenderPanel";
import { TriggerSourceSection } from "@/scale/pages/triggers/TriggerSourceSection";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";

function inspectorTitle(selection: TriggerCanvasSelection): string {
  if (selection === "trigger") return "Trigger";
  if (selection === "template") return "Outbound sender";
  return "General settings";
}

export function TriggerConfigInspector({ selection }: { selection: TriggerCanvasSelection }) {
  const { trigger } = useTriggerDetail();
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
    <aside
      className={[
        "my-3 mr-3 flex w-[min(100%,22rem)] shrink-0 flex-col",
        "border border-r-0 border-border bg-background",
        "rounded-tl-3xl rounded-bl-3xl",
      ].join(" ")}
    >
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{inspectorTitle(selection)}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {selection === "trigger"
            ? "Source, cooldown, and activation."
            : selection === "template"
              ? "From address shown on sent mail."
              : "Name, purpose, and lifecycle."}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {selection === "trigger" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
  );
}
