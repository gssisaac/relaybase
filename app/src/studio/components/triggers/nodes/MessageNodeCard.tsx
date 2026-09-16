"use client";

import { Eye, Mail, Pencil, Type } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { WorkflowPort } from "@/studio/components/triggers/nodes/WorkflowPort";
import { triggerContentEditHref } from "@/studio/lib/paths";
import type { Trigger } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

export function MessageNodeCard({
  triggerId,
  trigger,
  messageName,
  selected,
  flowActive,
  onSelect,
  onPreview,
}: {
  triggerId: string;
  trigger: Trigger;
  messageName: string | null;
  selected: boolean;
  flowActive?: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const subject = trigger.subject?.trim() || "No subject yet";
  const fromEmail = trigger.fromEmail?.trim() || "Select sender";
  const fromName = trigger.fromName?.trim();
  const fromLine = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const editable = trigger.listStatus !== "archived";

  return (
    <div
      className={cn(
        "relative flex w-[min(100%,22rem)] shrink-0 flex-col overflow-visible rounded-xl border bg-card shadow-sm transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/40",
      )}
    >
      <WorkflowPort side="input" active={flowActive} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="flex flex-col text-left"
      >
        <div className="flex items-start gap-2 border-b border-border px-4 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Mail className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Send email</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {messageName?.trim() || "Message"}
            </p>
          </div>
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-start gap-2 text-xs">
            <Type className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-muted-foreground">Subject</p>
              <p className="truncate font-medium text-foreground">{subject}</p>
            </div>
          </div>
          <div className="truncate text-xs text-muted-foreground" title={fromLine}>
            From · {fromLine}
          </div>
        </div>
      </button>
      <div className="flex gap-2 border-t border-border px-4 py-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          <Eye className="size-3.5" aria-hidden />
          Preview
        </Button>
        {editable ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            nativeButton={false}
            render={<Link href={triggerContentEditHref(triggerId)} />}
            onClick={(e) => e.stopPropagation()}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Button>
        ) : null}
      </div>
    </div>
  );
}
