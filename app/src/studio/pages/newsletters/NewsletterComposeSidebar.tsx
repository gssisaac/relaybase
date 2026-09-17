"use client";

import { Code2, PanelRightClose, PanelRightOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ComposeMergeTagInsertList } from "@/studio/components/ComposeMergeTagInsertList";
import { NewsletterLogoFooterSection } from "@/studio/components/newsletters/NewsletterLogoFooterSection";
import { NewsletterTemplateVariablesEditor } from "@/studio/components/newsletters/NewsletterTemplateVariablesEditor";
import type { ComposeMergeTagSection } from "@/studio/lib/triggers/trigger-merge-tags";
import { splitTemplateVariableFields } from "@/studio/lib/layouts/layout-template-variables";
import { LayoutCodeEditorDialog } from "@/studio/components/layouts/LayoutCodeEditorDialog";
import { LayoutImportDialog } from "@/studio/components/layouts/LayoutImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutThumbnailPreview } from "@/studio/components/layouts/LayoutThumbnailPreview";
import { templateThumbnailVariant } from "@/studio/lib/newsletters/newsletter-merge-tags";
import { isPlainTextTemplate } from "@/studio/lib/layouts/layout-catalog";
import type { StudioAccountCompliance } from "@/studio/api";
import type { StudioLayout } from "@/studio/api";
import type { CrmContentAssetOwner } from "@/lib/markdown-editor/utils/newsletter-upload";
import { cn } from "@/lib/utils";

export function NewsletterComposeSidebar({
  newsletterId,
  assetOwner = "newsletter",
  templates,
  templateId,
  setTemplateId,
  templateVariables,
  setTemplateVariables,
  editable,
  compliance,
  complianceIdentityId,
  accountDefaultComplianceIdentityId,
  onComplianceIdentityChange,
  onComplianceIdentitySaved,
  onTemplateImported,
  onTemplateSourceSaved,
  collapsed,
  onCollapsedChange,
  presentation = "aside",
  mergeTagSections,
  onInsertMergeTag,
}: {
  newsletterId: string;
  assetOwner?: CrmContentAssetOwner;
  templates: StudioLayout[];
  templateId: string;
  setTemplateId: (id: string) => void;
  templateVariables: Record<string, string>;
  setTemplateVariables: (values: Record<string, string>) => void;
  editable: boolean;
  compliance: StudioAccountCompliance | null;
  complianceIdentityId: string | null;
  accountDefaultComplianceIdentityId: string | null;
  onComplianceIdentityChange: (id: string | null) => void | Promise<void>;
  onComplianceIdentitySaved?: () => void;
  onTemplateImported?: (templateId: string) => void;
  onTemplateSourceSaved?: (result: { templateId: string; forked: boolean }) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** `panel` — full-height body for Sheet; `aside` — fixed column with collapse control. */
  presentation?: "aside" | "panel";
  mergeTagSections?: ComposeMergeTagSection[];
  onInsertMergeTag?: (token: string) => void;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [codeEditorTemplate, setCodeEditorTemplate] = useState<StudioLayout | null>(null);
  const [layoutSearch, setLayoutSearch] = useState("");

  const template = templates.find((t) => t.id === templateId);
  const filteredTemplates = useMemo(() => {
    const q = layoutSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
    );
  }, [layoutSearch, templates]);
  const { logoFooterSchema, layoutSchema } = useMemo(
    () => splitTemplateVariableFields(template?.variablesSchema ?? null),
    [template?.variablesSchema],
  );

  if (presentation === "aside" && collapsed) {
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

  const shellClassName =
    presentation === "panel"
      ? "flex min-h-0 flex-1 flex-col overflow-hidden"
      : "flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-border lg:w-[280px] lg:border-l";

  return (
    <>
      <aside className={shellClassName}>
        {presentation === "aside" ? (
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
        ) : null}
        <Tabs defaultValue="templates" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="shrink-0 border-b border-border px-2 py-2">
            <TabsList variant="line" className="h-8 w-full justify-start gap-0 px-0">
              <TabsTrigger value="templates" className="flex-1 px-0.5 text-[11px]">
                Layout
              </TabsTrigger>
              <TabsTrigger value="logo-footer" className="flex-1 px-0.5 text-[11px]">
                Logo & Footer
              </TabsTrigger>
              <TabsTrigger value="variables" className="flex-1 px-0.5 text-[11px]">
                Variables
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="templates" className="mt-0 flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border px-2 py-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={layoutSearch}
                  onChange={(e) => setLayoutSearch(e.target.value)}
                  placeholder="Search layouts…"
                  autoComplete="off"
                  className="h-8 border-border/60 bg-background pl-8 text-xs shadow-none"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {templates.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">No layouts yet</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">No matching layouts</p>
            ) : (
              <ul
                className={cn(
                  "gap-2",
                  presentation === "panel" ? "grid grid-cols-2" : "flex flex-col",
                )}
              >
                {filteredTemplates.map((t) => {
                  const selected = t.id === templateId;
                  const variant = templateThumbnailVariant(t.id, t.derivedFromLayoutId);
                  return (
                    <li key={t.id} className="min-w-0">
                      <div
                        className={cn(
                          "group relative h-full w-full rounded-md border bg-card p-2 text-left transition-colors",
                          selected ? "border-primary ring-1 ring-primary/30" : "border-border",
                        )}
                      >
                        {editable ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            className={cn(
                              "absolute right-1 top-1 z-10 size-6 bg-background opacity-0 shadow-none transition-opacity",
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
                        <LayoutThumbnailPreview
                          layoutId={t.id}
                          isBuiltin={t.isBuiltin}
                          htmlSource={t.htmlSource}
                          variablesSchema={t.variablesSchema}
                          variant={variant}
                          className="mb-1.5"
                        />
                        <span
                          className={cn(
                            "block font-medium leading-snug",
                            presentation === "panel" ? "text-xs" : "text-sm",
                          )}
                        >
                          {t.name}
                        </span>
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
            </div>
          </TabsContent>

          <TabsContent value="logo-footer" className="mt-0 min-h-0 flex-1 overflow-y-auto p-2">
            <NewsletterLogoFooterSection
              newsletterId={newsletterId}
              assetOwner={assetOwner}
              logoFooterSchema={logoFooterSchema}
              templateVariables={templateVariables}
              setTemplateVariables={setTemplateVariables}
              editable={editable}
              complianceOrganizationName={compliance?.organizationName}
              complianceIdentityId={complianceIdentityId}
              accountDefaultComplianceIdentityId={accountDefaultComplianceIdentityId}
              onComplianceIdentityChange={onComplianceIdentityChange}
              onComplianceIdentitySaved={onComplianceIdentitySaved}
            />
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
              Template
            </p>
            <NewsletterTemplateVariablesEditor
              newsletterId={newsletterId}
              assetOwner={assetOwner}
              schema={layoutSchema}
              values={templateVariables}
              onChange={setTemplateVariables}
              editable={editable}
              complianceOrganizationName={compliance?.organizationName}
              emptyMessage="This layout has no extra template variables."
            />
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
