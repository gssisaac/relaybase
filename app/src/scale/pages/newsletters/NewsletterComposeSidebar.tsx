"use client";

import { Code2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useState } from "react";

import { ComposeMergeTagInsertList } from "@/scale/components/ComposeMergeTagInsertList";
import { NewsletterTemplateVariablesEditor } from "@/scale/components/newsletters/NewsletterTemplateVariablesEditor";
import type { ComposeMergeTagSection } from "@/scale/lib/triggers/trigger-merge-tags";
import { ComplianceIdentityEditor } from "@/scale/components/ComplianceIdentityEditor";
import { NewsletterPreflightChecklist } from "@/scale/components/newsletters/NewsletterPreflightChecklist";
import { LayoutCodeEditorDialog } from "@/scale/components/layouts/LayoutCodeEditorDialog";
import { LayoutImportDialog } from "@/scale/components/layouts/LayoutImportDialog";
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
  displayNameForRecipient,
  templateThumbnailVariant,
  type PreviewPersonaId,
  type PreviewRecipient,
} from "@/scale/lib/newsletters/newsletter-merge-tags";
import { runNewsletterPreflight } from "@/scale/lib/newsletters/newsletter-preflight";
import { isPlainTextTemplate } from "@/scale/lib/layouts/layout-catalog";
import type { ScaleAccountCompliance } from "@/lib/scale/api";
import type { ScaleLayout } from "@/lib/scale/api";
import type { CrmContentAssetOwner } from "@/lib/markdown-editor/utils/newsletter-upload";
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
          <div className="mb-1.5 flex items-center gap-1">
            <div className="size-2.5 shrink-0 rounded-sm bg-muted-foreground/25" />
            <div className="h-1 flex-1 rounded-sm bg-muted-foreground/20" />
          </div>
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

export function NewsletterComposeSidebar({
  newsletterId,
  assetOwner = "newsletter",
  preflightSettingsHref,
  templates,
  templateId,
  setTemplateId,
  templateVariables,
  setTemplateVariables,
  editable,
  subject,
  bodyMarkdown,
  fromEmail,
  fromName,
  compliance,
  complianceIdentityId,
  accountDefaultComplianceIdentityId,
  onComplianceIdentityChange,
  onComplianceIdentitySaved,
  previewPersonaId,
  setPreviewPersonaId,
  previewRecipient,
  personaOptions,
  onTemplateImported,
  onTemplateSourceSaved,
  collapsed,
  onCollapsedChange,
  mergeTagSections,
  onInsertMergeTag,
  triggerPreviewValues,
}: {
  newsletterId: string;
  assetOwner?: CrmContentAssetOwner;
  preflightSettingsHref?: string | null;
  templates: ScaleLayout[];
  templateId: string;
  setTemplateId: (id: string) => void;
  templateVariables: Record<string, string>;
  setTemplateVariables: (values: Record<string, string>) => void;
  editable: boolean;
  subject: string;
  bodyMarkdown: string;
  fromEmail: string | null;
  fromName: string | null;
  compliance: ScaleAccountCompliance | null;
  complianceIdentityId: string | null;
  accountDefaultComplianceIdentityId: string | null;
  onComplianceIdentityChange: (id: string | null) => void | Promise<void>;
  onComplianceIdentitySaved?: () => void;
  previewPersonaId: PreviewPersonaId;
  setPreviewPersonaId: (id: PreviewPersonaId) => void;
  previewRecipient: PreviewRecipient;
  personaOptions: { value: PreviewPersonaId; label: string }[];
  onTemplateImported?: (templateId: string) => void;
  onTemplateSourceSaved?: (result: { templateId: string; forked: boolean }) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mergeTagSections?: ComposeMergeTagSection[];
  onInsertMergeTag?: (token: string) => void;
  triggerPreviewValues?: Record<string, string>;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [codeEditorTemplate, setCodeEditorTemplate] = useState<ScaleLayout | null>(null);

  const template = templates.find((t) => t.id === templateId);
  const preflight = runNewsletterPreflight({
    subject,
    bodyMarkdown,
    templateHtml: template?.htmlSource ?? "",
    templateId,
    templateVariablesSchema: template?.variablesSchema ?? null,
    templateVariables,
    fromEmail,
    fromName,
    compliance,
  });

  if (collapsed) {
    return (
      <div className="flex shrink-0 flex-col items-center border-border py-2 lg:border-l">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Expand sidebar"
          onClick={() => onCollapsedChange(false)}
        >
          <PanelRightOpen className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-border lg:w-[280px] lg:border-l">
        <div className="flex shrink-0 items-center justify-end border-b border-border px-2 py-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Collapse sidebar"
            onClick={() => onCollapsedChange(true)}
          >
            <PanelRightClose className="size-4" />
          </Button>
        </div>
        <Tabs defaultValue="templates" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="shrink-0 border-b border-border px-2 py-2">
            <TabsList variant="line" className="h-8 w-full justify-start gap-0 px-0">
              <TabsTrigger value="templates" className="flex-1 px-1 text-xs">
                Templates
              </TabsTrigger>
              <TabsTrigger value="variables" className="flex-1 px-1 text-xs">
                Variables
              </TabsTrigger>
              <TabsTrigger value="preflight" className="flex-1 px-1 text-xs">
                Pre-flight
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
                  const variant = templateThumbnailVariant(t.id, t.derivedFromLayoutId);
                  return (
                    <li key={t.id}>
                      <div
                        className={cn(
                          "group relative w-full rounded-md border bg-card p-2.5 text-left transition-colors",
                          selected ? "border-primary ring-1 ring-primary/30" : "border-border",
                        )}
                      >
                        {editable ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            className={cn(
                              "absolute right-1.5 top-1.5 z-10 size-7 bg-background opacity-0 shadow-none transition-opacity",
                              "group-hover:opacity-100 group-focus-within:opacity-100",
                              "focus-visible:opacity-100",
                            )}
                            aria-label={`View HTML for ${t.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCodeEditorTemplate(t);
                            }}
                          >
                            <Code2 className="size-3.5" />
                          </Button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!editable}
                          onClick={() => setTemplateId(t.id)}
                          className={cn(
                            "relative z-0 w-full text-left",
                            "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
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
                        ) : (
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            Custom import
                          </span>
                        )}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {editable ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setImportOpen(true)}
              >
                Import HTML template
              </Button>
            ) : null}
          </TabsContent>

          <TabsContent value="variables" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
            {mergeTagSections?.some((s) => s.tags.length) && onInsertMergeTag ? (
              <div className="mb-4 rounded-md border border-border bg-muted/20 p-2.5">
                <p className="mb-2 text-xs font-medium text-foreground">Personalization</p>
                <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                  Click to insert at the cursor in the subject or body (focus the field first).
                </p>
                <ComposeMergeTagInsertList
                  sections={mergeTagSections}
                  onInsert={onInsertMergeTag}
                />
              </div>
            ) : null}
            <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Layout
            </p>
            <NewsletterTemplateVariablesEditor
              newsletterId={newsletterId}
              assetOwner={assetOwner}
              schema={template?.variablesSchema ?? null}
              values={templateVariables}
              onChange={setTemplateVariables}
              editable={editable}
              complianceOrganizationName={compliance?.organizationName}
            />
            <div className="mb-3 rounded-md border border-border bg-muted/20 p-2.5">
              <ComplianceIdentityEditor
                mode="newsletter"
                compact
                selectedIdentityId={complianceIdentityId}
                accountDefaultIdentityId={accountDefaultComplianceIdentityId}
                onSelectedIdentityIdChange={onComplianceIdentityChange}
                onIdentitySaved={() => onComplianceIdentitySaved?.()}
                description="Footer org, address, and contact come from the selected sender — edit once, reused everywhere."
              />
            </div>
          </TabsContent>

          <TabsContent value="preflight" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
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
                <p className="font-medium text-foreground">Resolved recipient</p>
                <dl className="mt-2 space-y-1.5 text-muted-foreground">
                  <div className="flex justify-between gap-2">
                    <dt>{`{{contact.name}}`}</dt>
                    <dd className="truncate text-right text-foreground">
                      {displayNameForRecipient(previewRecipient)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>{`{{contact.email}}`}</dt>
                    <dd className="truncate text-right text-foreground">{previewRecipient.email}</dd>
                  </div>
                </dl>
              </div>

              {triggerPreviewValues && Object.keys(triggerPreviewValues).length ? (
                <div className="rounded-md border border-border bg-muted/20 p-2.5 text-[11px]">
                  <p className="font-medium text-foreground">Sample trigger payload</p>
                  <dl className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-muted-foreground">
                    {Object.entries(triggerPreviewValues).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <dt className="shrink-0">{`{{trigger.${key}}}`}</dt>
                        <dd className="truncate text-right text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <NewsletterPreflightChecklist
                checks={preflight}
                newsletterId={newsletterId}
                settingsHref={preflightSettingsHref}
              />
            </div>
          </TabsContent>
        </Tabs>
      </aside>
      <LayoutImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(id) => {
          onTemplateImported?.(id);
          setTemplateId(id);
        }}
      />
      <LayoutCodeEditorDialog
        template={codeEditorTemplate}
        open={codeEditorTemplate !== null}
        onOpenChange={(next) => {
          if (!next) setCodeEditorTemplate(null);
        }}
        onSaved={({ template: saved, forked }) => {
          onTemplateSourceSaved?.({ templateId: saved.id, forked });
          if (forked) setTemplateId(saved.id);
        }}
      />
    </>
  );
}
