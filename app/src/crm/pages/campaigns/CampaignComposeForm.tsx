"use client";

import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CrmTemplate } from "@/lib/crm/api";

const MarkdownEditor = dynamic(() => import("./MarkdownEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

/**
 * Content editor for a campaign — template, subject, body, preview, Save.
 * Recipients and Send live on the Publish tab.
 */
export function CampaignComposeForm({
  campaignId,
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
  campaignId: string;
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm"
    >
      <div className="flex shrink-0 flex-col divide-y divide-border/20 px-4">
        <div className="flex shrink-0 items-center gap-2 py-1">
          <span className="w-16 shrink-0 select-none text-xs font-medium text-muted-foreground">
            Template:
          </span>
          <Select
            items={templates.map((t) => ({ value: t.id, label: t.name }))}
            value={templateId || null}
            onValueChange={(next) => {
              if (next) setTemplateId(next);
            }}
            disabled={!editable || templates.length === 0}
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-full min-w-0 flex-1 border-0 bg-transparent px-2 py-0 shadow-none focus:ring-0 data-[size=sm]:h-8"
            >
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex shrink-0 items-center py-1">
          <span className="w-16 shrink-0 select-none text-xs font-medium text-muted-foreground">
            Subject:
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject..."
            autoFocus={editable}
            disabled={!editable}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border/20 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <MarkdownEditor
            key={campaignId}
            value={bodyMarkdown}
            onChange={onBodyChange}
            editable={editable}
          />
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-end gap-1 px-3 py-1.5">
            <Button
              size="sm"
              variant={device === "desktop" ? "secondary" : "ghost"}
              onClick={() => setDevice("desktop")}
            >
              Desktop
            </Button>
            <Button
              size="sm"
              variant={device === "mobile" ? "secondary" : "ghost"}
              onClick={() => setDevice("mobile")}
            >
              Mobile
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4">
            <div
              className={
                device === "mobile" ? "mx-auto max-w-[375px]" : "mx-auto max-w-[640px]"
              }
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
            />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/20 bg-muted/10 px-4 py-3">
        <span className="select-none text-xs text-muted-foreground/60">
          {draftStatus ?? ""}
        </span>
        {editable ? (
          <Button
            size="sm"
            onClick={onSave}
            disabled={saveState === "saving"}
            className="px-4"
          >
            {saveState === "saving" ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
