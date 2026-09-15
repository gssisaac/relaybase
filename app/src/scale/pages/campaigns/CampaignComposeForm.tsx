"use client";

import { Braces, Monitor, Smartphone } from "lucide-react";
import { useCallback, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ComposeMergeTagInsertList } from "@/scale/components/ComposeMergeTagInsertList";
import { CampaignEmailPreview } from "@/scale/components/campaigns/CampaignEmailPreview";
import { CampaignComposeSidebar } from "@/scale/pages/campaigns/CampaignComposeSidebar";
import type { ComposeMergeTagSection } from "@/scale/lib/triggers/trigger-merge-tags";
import {
  BROADCAST_MERGE_TAGS,
  type PreviewPersonaId,
  type PreviewRecipient,
} from "@/scale/lib/campaigns/campaign-merge-tags";
import type { ScaleAccountCompliance, ScaleLayout } from "@/lib/scale/api";
import type { CrmContentAssetOwner } from "@/lib/markdown-editor/utils/campaign-upload";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";
import type { EditorSnapshotProvider } from "@/lib/markdown-editor/persistence/types";
/**
 * Content editor for a campaign — template, subject, body, preview, Save.
 * Recipients and Send live on the Publish tab.
 */
export function CampaignComposeForm({
  campaignId,
  assetOwner = "campaign",
  editorRef,
  templates,
  templateId,
  setTemplateId,
  templateVariables,
  setTemplateVariables,
  subject,
  setSubject,
  bodyMarkdown,
  onBodyChange,
  renderedPreview,
  previewSubject,
  previewFromName,
  previewFromEmail,
  previewToEmail,
  previewIsPlainText,
  device,
  setDevice,
  editable,
  saveState,
  onSave,
  previewPersonaId,
  setPreviewPersonaId,
  previewRecipient,
  personaOptions,
  compliance,
  complianceIdentityId,
  accountDefaultComplianceIdentityId,
  onComplianceIdentityChange,
  onComplianceIdentitySaved,
  onTemplateImported,
  onTemplateSourceSaved,
  mergeTagSections,
  triggerPreviewValues,
}: {
  /** Campaign id — asset upload namespace (`/scale/campaigns/:id/assets`). */
  campaignId: string;
  assetOwner?: CrmContentAssetOwner;
  editorRef: RefObject<EditorSnapshotProvider | null>;
  templates: ScaleLayout[];
  templateId: string;
  setTemplateId: (id: string) => void;
  templateVariables: Record<string, string>;
  setTemplateVariables: (values: Record<string, string>) => void;
  subject: string;
  setSubject: (v: string) => void;
  bodyMarkdown: string;
  onBodyChange: (content: { markdown: string; html: string }) => void;
  renderedPreview: string;
  previewSubject: string;
  previewFromName: string | null;
  previewFromEmail: string;
  previewToEmail: string;
  previewIsPlainText: boolean;
  device: "desktop" | "mobile";
  setDevice: (device: "desktop" | "mobile") => void;
  editable: boolean;
  saveState: "idle" | "saving" | "error";
  onSave: () => void;
  previewPersonaId: PreviewPersonaId;
  setPreviewPersonaId: (id: PreviewPersonaId) => void;
  previewRecipient: PreviewRecipient;
  personaOptions: { value: PreviewPersonaId; label: string }[];
  compliance: ScaleAccountCompliance | null;
  complianceIdentityId: string | null;
  accountDefaultComplianceIdentityId: string | null;
  onComplianceIdentityChange: (id: string | null) => void | Promise<void>;
  onComplianceIdentitySaved?: () => void;
  onTemplateImported?: (templateId: string) => void;
  onTemplateSourceSaved?: (result: { templateId: string; forked: boolean }) => void;
  /** When set (automations), subject/body tag pickers include trigger payload tags. */
  mergeTagSections?: ComposeMergeTagSection[];
  /** Sample values for pre-flight preview of `{{trigger.*}}` tags. */
  triggerPreviewValues?: Record<string, string>;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const editorShellRef = useRef<HTMLDivElement>(null);
  const insertTargetRef = useRef<"subject" | "body">("body");

  const resolveInsertTarget = useCallback((): "subject" | "body" => {
    const active = document.activeElement;
    const subjectEl = subjectInputRef.current;
    if (subjectEl && active === subjectEl) return "subject";
    if (editorShellRef.current && active && editorShellRef.current.contains(active)) {
      return "body";
    }
    return insertTargetRef.current;
  }, []);

  const insertMergeTag = useCallback(
    (token: string) => {
      const target = resolveInsertTarget();
      if (target === "subject" && subjectInputRef.current) {
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
    [editorRef, resolveInsertTarget, setSubject],
  );

  const draftStatus =
    !editable
      ? null
      : saveState === "saving"
        ? "Saving…"
        : saveState === "error"
          ? "Unsaved · retrying"
          : "Saved";

  const tagSections: ComposeMergeTagSection[] =
    mergeTagSections ??
    [
      {
        title: "Recipient",
        tags: BROADCAST_MERGE_TAGS.map((t) => ({
          id: t.id,
          token: t.token,
          label: t.label,
        })),
      },
    ];

  return (
    <div
      data-allow-tab-focus
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border"
    >
      <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-hidden lg:flex-row lg:divide-x lg:divide-y-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-3 py-2">
            <span className="shrink-0 text-sm text-muted-foreground">Subject:</span>
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
                      aria-label="Insert personalization tag"
                      onMouseDown={(e) => {
                        insertTargetRef.current = resolveInsertTarget();
                        e.preventDefault();
                      }}
                    />
                  }
                >
                  <Braces className="size-4" />
                </PopoverTrigger>
                <PopoverContent align="end" className="max-h-[min(420px,70vh)] w-72 overflow-y-auto p-2">
                  <p className="mb-2 px-1 text-[11px] text-muted-foreground">
                    Inserts at the cursor in the subject or body field you last focused.
                  </p>
                  <ComposeMergeTagInsertList
                    compact
                    sections={tagSections}
                    onInsert={insertMergeTag}
                  />
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
            ref={editorShellRef}
            className="relative min-h-0 flex-1 overflow-hidden bg-background"
            onFocusCapture={() => {
              insertTargetRef.current = "body";
            }}
          >
            <div className="absolute inset-0 bg-background">
              <MarkdownEditor
                ref={editorRef}
                key={campaignId}
                campaignId={campaignId}
                documentId={campaignId}
                assetOwner={assetOwner}
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
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f6f8fc]"
            style={{ colorScheme: "light" }}
          >
            <CampaignEmailPreview
              subject={previewSubject}
              fromName={previewFromName}
              fromEmail={previewFromEmail}
              toEmail={previewToEmail}
              bodyHtml={renderedPreview}
              bodyPlainText={renderedPreview}
              previewIsPlainText={previewIsPlainText}
              device={device}
            />
          </div>
        </div>

        {editable ? (
          <CampaignComposeSidebar
            campaignId={campaignId}
            assetOwner={assetOwner}
            preflightSettingsHref={assetOwner === "template" ? null : undefined}
            templates={templates}
            templateId={templateId}
            setTemplateId={setTemplateId}
            templateVariables={templateVariables}
            setTemplateVariables={setTemplateVariables}
            editable={editable}
            subject={subject}
            bodyMarkdown={bodyMarkdown}
            fromEmail={previewFromEmail}
            fromName={previewFromName}
            compliance={compliance}
            complianceIdentityId={complianceIdentityId}
            accountDefaultComplianceIdentityId={accountDefaultComplianceIdentityId}
            onComplianceIdentityChange={onComplianceIdentityChange}
            onComplianceIdentitySaved={onComplianceIdentitySaved}
            previewPersonaId={previewPersonaId}
            setPreviewPersonaId={setPreviewPersonaId}
            previewRecipient={previewRecipient}
            personaOptions={personaOptions}
            onTemplateImported={onTemplateImported}
            onTemplateSourceSaved={onTemplateSourceSaved}
            mergeTagSections={tagSections}
            onInsertMergeTag={insertMergeTag}
            triggerPreviewValues={triggerPreviewValues}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        ) : null}
      </div>
    </div>
  );
}
