"use client";

import { Braces, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  applyBroadcastMergeTags,
  BROADCAST_MERGE_TAGS,
  displayNameForRecipient,
  previewPersonaOptions,
  templateThumbnailVariant,
  type PreviewPersonaId,
  type PreviewRecipient,
} from "@/crm/lib/broadcast-merge-tags";
import { isPlainTextTemplate } from "@/crm/lib/broadcast-templates";
import type { CrmTemplate } from "@/lib/crm/api";
import { cn } from "@/lib/utils";

function TemplateWireframe({ variant }: { variant: "minimal" | "header" | "card" | "plain" }) {
  if (variant === "plain") {
    return (
      <div className="pointer-events-none mb-2 px-0.5" aria-hidden>
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
        "pointer-events-none mb-2 overflow-hidden rounded border border-border/80 bg-muted/30",
        variant === "card" && "p-1",
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
          <div className="mb-1.5 h-1.5 rounded-sm bg-slate-800 dark:bg-slate-600" />
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

function MergeTagRow({
  tag,
  editable,
  onInsert,
}: {
  tag: (typeof BROADCAST_MERGE_TAGS)[number];
  editable: boolean;
  onInsert: (token: string) => void;
}) {
  async function copyToken() {
    try {
      await navigator.clipboard.writeText(tag.token);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <li className="rounded-md border border-border bg-card p-2.5">
      <code className="block text-[11px] font-medium text-foreground">{tag.token}</code>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{tag.description}</p>
      <p className="mt-1 text-[10px] text-muted-foreground/80">
        Preview e.g. <span className="text-foreground/80">{tag.example}</span>
      </p>
      {tag.fallbackHint ? (
        <p className="mt-1 text-[10px] text-muted-foreground/70">{tag.fallbackHint}</p>
      ) : null}
      <div className="mt-2 flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 flex-1 gap-1 text-xs"
          disabled={!editable}
          onClick={() => onInsert(tag.token)}
        >
          <Plus className="size-3" />
          Insert
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className="size-7 shrink-0"
          aria-label={`Copy ${tag.token}`}
          onClick={() => void copyToken()}
        >
          <Copy className="size-3" />
        </Button>
      </div>
    </li>
  );
}

export function BroadcastComposeSidebar({
  templates,
  templateId,
  setTemplateId,
  editable,
  previewPersonaId,
  setPreviewPersonaId,
  previewRecipient,
  previewSubject,
  previewBodySnippet,
  personaOptions,
  onInsertMergeTag,
}: {
  templates: CrmTemplate[];
  templateId: string;
  setTemplateId: (id: string) => void;
  editable: boolean;
  previewPersonaId: PreviewPersonaId;
  setPreviewPersonaId: (id: PreviewPersonaId) => void;
  previewRecipient: PreviewRecipient;
  previewSubject: string;
  previewBodySnippet: string;
  personaOptions: { value: PreviewPersonaId; label: string }[];
  onInsertMergeTag: (token: string) => void;
}) {
  const resolvedSubject = applyBroadcastMergeTags(previewSubject, previewRecipient, {
    unsubscribeUrl: "#",
  });
  const resolvedSnippet = applyBroadcastMergeTags(previewBodySnippet, previewRecipient, {
    unsubscribeUrl: "#",
  });
  const displayName = displayNameForRecipient(previewRecipient);

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-border lg:w-[260px] lg:border-l">
      <Tabs defaultValue="templates" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="shrink-0 border-b border-border px-2 py-2">
          <TabsList variant="line" className="h-8 w-full justify-start gap-0 px-0">
            <TabsTrigger value="templates" className="flex-1 px-1 text-xs">
              Templates
            </TabsTrigger>
            <TabsTrigger value="variables" className="flex-1 px-1 text-xs">
              Variables
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-1 px-1 text-xs">
              Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="templates" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
          {templates.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">No templates yet</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {templates.map((t) => {
                const selected = t.id === templateId;
                const variant = templateThumbnailVariant(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => setTemplateId(t.id)}
                      className={cn(
                        "w-full rounded-md border bg-card p-2.5 text-left transition-colors",
                        "hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60",
                        selected ? "border-primary ring-1 ring-primary/30" : "border-border",
                      )}
                    >
                      <TemplateWireframe variant={variant} />
                      <span className="block text-sm font-medium leading-snug">{t.name}</span>
                      {t.isBuiltin ? (
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {isPlainTextTemplate(t.id)
                            ? "Built-in · plain text"
                            : "Built-in · 600px max width"}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="variables" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
          <p className="mb-2 flex items-start gap-1.5 px-0.5 text-[11px] leading-snug text-muted-foreground">
            <Braces className="mt-0.5 size-3 shrink-0" aria-hidden />
            Insert into the subject or body. Tags are replaced per recipient at send time.
          </p>
          <ul className="flex flex-col gap-2">
            {BROADCAST_MERGE_TAGS.map((tag) => (
              <MergeTagRow
                key={tag.id}
                tag={tag}
                editable={editable}
                onInsert={onInsertMergeTag}
              />
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="preview" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Preview as</p>
              <Select
                value={previewPersonaId}
                onValueChange={(value) => setPreviewPersonaId(value as PreviewPersonaId)}
                items={personaOptions}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Choose recipient" />
                </SelectTrigger>
                <SelectContent>
                  {personaOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-2.5 text-[11px]">
              <p className="font-medium text-foreground">Resolved values</p>
              <dl className="mt-2 space-y-1.5 text-muted-foreground">
                <div className="flex justify-between gap-2">
                  <dt>{`{{contact.name}}`}</dt>
                  <dd className="truncate text-right text-foreground">{displayName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{`{{contact.email}}`}</dt>
                  <dd className="truncate text-right text-foreground">{previewRecipient.email}</dd>
                </div>
              </dl>
            </div>

            {resolvedSubject.trim() ? (
              <div className="rounded-md border border-border bg-card p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Subject
                </p>
                <p className="mt-1 text-xs leading-snug text-foreground">{resolvedSubject}</p>
              </div>
            ) : null}

            {resolvedSnippet.trim() ? (
              <div className="rounded-md border border-border bg-card p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Body snippet
                </p>
                <p className="mt-1 line-clamp-4 text-xs leading-snug text-foreground">
                  {resolvedSnippet}
                </p>
              </div>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
