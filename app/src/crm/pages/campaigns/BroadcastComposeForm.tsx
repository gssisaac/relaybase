"use client";

import { Braces, Monitor, Smartphone } from "lucide-react";
import { useCallback, useRef, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BroadcastComposeSidebar } from "@/crm/pages/campaigns/BroadcastComposeSidebar";
import {
  BROADCAST_MERGE_TAGS,
  type PreviewPersonaId,
  type PreviewRecipient,
} from "@/crm/lib/broadcast-merge-tags";
import type { CrmTemplate } from "@/lib/crm/api";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";
import type { EditorSnapshotProvider } from "@/lib/markdown-editor/persistence/types";
import { cn } from "@/lib/utils";

/**
 * Content editor for a broadcast — template, subject, body, preview, Save.
 * Recipients and Send live on the Publish tab.
 */
export function BroadcastComposeForm({
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
  previewPersonaId,
  setPreviewPersonaId,
  previewRecipient,
  personaOptions,
}: {
  /** Broadcast id — asset upload namespace (`/crm/broadcasts/:id/assets`). */
  broadcastId: string;
  editorRef: RefObject<EditorSnapshotProvider | null>;
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
  previewPersonaId: PreviewPersonaId;
  setPreviewPersonaId: (id: PreviewPersonaId) => void;
  previewRecipient: PreviewRecipient;
  personaOptions: { value: PreviewPersonaId; label: string }[];
}) {
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const insertTargetRef = useRef<"subject" | "body">("body");

  const insertMergeTag = useCallback(
    (token: string) => {
      if (insertTargetRef.current === "subject" && subjectInputRef.current) {
        const el = subjectInputRef.current;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? start;
        const next = `${el.value.slice(0, start)}${token}${el.value.slice(end)}`;
        setSubject(next);
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + token.length;
          el.setSelectionRange(pos, pos);
        });
        return;
      }
      editorRef.current?.insertText?.(token);
    },
    [editorRef, setSubject],
  );

  const previewBodySnippet =
    bodyMarkdown.trim().slice(0, 280) ||
    renderedPreview.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280);

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
              ref={subjectInputRef}
              type="text"
              value={subject}
              onFocus={() => {
                insertTargetRef.current = "subject";
              }}
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
            {editable ? (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="shrink-0"
                      aria-label="Insert personalization tag in subject"
                    />
                  }
                >
                  <Braces className="size-4" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <p className="mb-2 px-1 text-[11px] text-muted-foreground">
                    Insert into subject
                  </p>
                  <ul className="flex flex-col gap-1">
                    {BROADCAST_MERGE_TAGS.map((tag) => (
                      <li key={tag.id}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto w-full justify-start px-2 py-1.5 font-normal"
                          onClick={() => {
                            insertTargetRef.current = "subject";
                            insertMergeTag(tag.token);
                          }}
                        >
                          <code className="text-xs">{tag.token}</code>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            ) : null}
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
          <div
            className="relative min-h-0 flex-1 overflow-hidden bg-background"
            onFocusCapture={() => {
              insertTargetRef.current = "body";
            }}
          >
            <div className="absolute inset-0 bg-background">
              <MarkdownEditor
                ref={editorRef}
                key={broadcastId}
                campaignId={broadcastId}
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

        <BroadcastComposeSidebar
          templates={templates}
          templateId={templateId}
          setTemplateId={setTemplateId}
          editable={editable}
          previewPersonaId={previewPersonaId}
          setPreviewPersonaId={setPreviewPersonaId}
          previewRecipient={previewRecipient}
          previewSubject={subject}
          previewBodySnippet={previewBodySnippet}
          personaOptions={personaOptions}
          onInsertMergeTag={insertMergeTag}
        />
      </div>
    </div>
  );
}
