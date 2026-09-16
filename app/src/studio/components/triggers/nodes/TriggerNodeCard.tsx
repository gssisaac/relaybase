"use client";

import { FileText, Inbox, Webhook, Zap } from "lucide-react";

import { WorkflowPort } from "@/studio/components/triggers/nodes/WorkflowPort";
import { TriggerStatusBadge } from "@/studio/components/triggers/TriggerStatusBadge";
import { triggerSourceSummary } from "@/studio/lib/triggers/trigger-label";
import type { Trigger } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

function sourceIcon(type: Trigger["source"]["type"]) {
  if (type === "mailbox_inbound") return Inbox;
  return Webhook;
}

function sourceTypeLabel(type: Trigger["source"]["type"]): string {
  if (type === "mailbox_inbound") return "Mailbox Inbound";
  return "HTTP Webhook";
}

function cooldownLabel(seconds: number): string {
  if (seconds <= 0) return "No cooldown";
  if (seconds % 86_400 === 0) {
    const days = seconds / 86_400;
    return days === 1 ? "Cooldown · 1 day" : `Cooldown · ${days} days`;
  }
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "Cooldown · 1 hour" : `Cooldown · ${hours} hours`;
  }
  return `Cooldown · ${seconds}s`;
}

export function TriggerNodeCard({
  trigger,
  selected,
  flowActive,
  onSelect,
}: {
  trigger: Trigger;
  selected: boolean;
  flowActive?: boolean;
  onSelect: () => void;
}) {
  const Icon = sourceIcon(trigger.source.type);
  const summary = triggerSourceSummary(trigger.source);

  return (
    <div
      className={cn(
        "relative w-[min(100%,20rem)] shrink-0 overflow-visible rounded-xl border bg-card shadow-sm transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/40",
      )}
    >
      <WorkflowPort side="output" active={flowActive} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="flex w-full flex-col rounded-xl text-left outline-none"
      >
      <div className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{sourceTypeLabel(trigger.source.type)}</p>
          <p className="truncate text-sm font-semibold text-foreground">{summary}</p>
        </div>
        <TriggerStatusBadge
          status={trigger.status}
          listStatus={trigger.listStatus}
          className="shrink-0"
        />
      </div>
      <div className="space-y-1 px-4 py-3 text-xs text-muted-foreground">
        <p>{cooldownLabel(trigger.cooldownSeconds)}</p>
        {trigger.applyMarketingSuppression ? (
          <p>Marketing suppression on</p>
        ) : (
          <p>Marketing suppression off</p>
        )}
      </div>
      </button>
    </div>
  );
}
