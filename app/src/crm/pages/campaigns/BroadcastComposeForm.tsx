"use client";

import { Monitor, Smartphone } from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import type { CrmTemplate } from "@/lib/crm/api";
import MarkdownEditor, { type MarkdownEditorHandle } from "@/lib/markdown-editor/components/MarkdownEditor";
import { cn } from "@/lib/utils";

/**
 * Content editor for a broadcast — template, subject, body, preview, Save.
 * Recipients and Send live on the Publish tab.
 */
export function BroadcastComposeForm({
  campaignId,
  broadcastId,
  editorRef,
  templates,
  templateId,
  setTemplateId,
  subject,
  setSubject,
  bodyMarkdown,
  onBodyChange,
  renderedPreview,
  device,
  setDevice,
  editable,
  saveState,
  onSave,
}: {
  /** Real campaign id — asset upload namespace only. */
  campaignId: string;
  broadcastId: string;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  templates: CrmTemplate[];
  templateId: string;
  setTemplateId: (id: string) => void;
  subject: string;
  setSubject: (v: string) => void;
  bodyMarkdown: string;
  onBodyChange: (content: { markdown: string; html: string }) => void;
  renderedPreview: string;
  device: "desktop" | "mobile";
  setDevice: (device: "desktop" | "mobile") => void;
  editable: boolean;
  saveState: "idle" | "saving" | "error";
  onSave: () => void;
}) {
  const draftStatus =
    !editable
      ? null
      : saveState === "saving"
        ? "Saving…"
        : saveState === "error"
          ? "Unsaved · retrying"
          : "Saved";

  return (
    <div
      data-allow-tab-focus
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border"
    >
      <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-hidden lg:flex-row lg:divide-x lg:divide-y-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="flex shrink-0 items-center gap-2 bg-background px-3 py-2">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject…"
              autoFocus={editable}
              disabled={!editable}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="min-w-0 flex-1 border-0 bg-background py-1 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {draftStatus ? (
              <span className="hidden shrink-0 select-none text-xs text-muted-foreground/60 sm:inline">
                {draftStatus}
              </span>
            ) : null}
            {editable ? (
              <Button
                size="sm"
                onClick={onSave}
                disabled={saveState === "saving"}
                className="shrink-0 px-4"
              >
                {saveState === "saving" ? "Saving…" : "Save"}
              </Button>
            ) : null}
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
            <div className="absolute inset-0 bg-background">
              <MarkdownEditor
                ref={editorRef}
                key={broadcastId}
                campaignId={campaignId}
                documentId={broadcastId}
                value={bodyMarkdown}
                onChange={onBodyChange}
                editable={editable}
              />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-center gap-0.5 border-b border-border px-2 py-1">
            <Button
              type="button"
              size="icon-sm"
              variant={device === "desktop" ? "secondary" : "ghost"}
              aria-label="Desktop preview"
              aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
            >
              <Monitor className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant={device === "mobile" ? "secondary" : "ghost"}
              aria-label="Mobile preview"
              aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}
            >
              <Smartphone className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto overflow-x-hidden bg-muted/15">
            <div
              className={cn(
                "min-h-full w-full [&_p]:my-[0.75em] [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
                device === "mobile" &&
                  "mx-auto box-border max-w-[375px] [&_table]:box-border [&_table]:max-w-full [&_table[width='600']]:!w-full",
              )}
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
            />
          </div>
        </div>

        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-border lg:w-[240px] lg:border-l">
          <div className="shrink-0 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            Template
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {templates.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">No templates yet</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {templates.map((t) => {
                  const selected = t.id === templateId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => setTemplateId(t.id)}
                        className={cn(
                          "w-full rounded-md border bg-card p-2.5 text-left transition-colors",
                          "hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60",
                          selected
                            ? "border-primary ring-1 ring-primary/30"
                            : "border-border",
                        )}
                      >
                        <span className="block text-sm font-medium leading-snug">
                          {t.name}
                        </span>
                        {t.isBuiltin ? (
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            Built-in
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
