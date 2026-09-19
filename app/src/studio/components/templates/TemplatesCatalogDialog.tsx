"use client";

import { ArrowLeft, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ListToolbar } from "@/email/components/mailbox/EmailListShell";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";
import { NewsletterEmailPreview } from "@/studio/components/newsletters/NewsletterEmailPreview";
import { CatalogTemplateUseActions } from "@/studio/components/templates/CatalogTemplateUseActions";
import { resolveTemplateLayout } from "@/studio/components/templates/TemplateThumbnailGrid";
import { TemplateThumbnailPreview } from "@/studio/components/templates/TemplateThumbnailPreview";
import { studioGalleryGridClassName } from "@/studio/lib/gallery/studio-gallery-grid";
import type { CatalogTemplateAudience } from "@/studio/lib/templates/catalog-template-audience";
import {
  catalogTemplateCardSubtitle,
  filterCatalogTemplatesByAudience,
} from "@/studio/lib/templates/catalog-template-audience";
import { isPresetCatalogTemplate } from "@/studio/lib/messages/message-library";
import { useCatalogTemplateRenderedPreview } from "@/studio/lib/templates/use-catalog-template-rendered-preview";
import { useTemplatesCatalog } from "@/studio/stores/templates-catalog";
import type { StudioTemplate } from "@/studio/api";
import { cn } from "@/lib/utils";

type DialogStep = "gallery" | "preview";

export type TemplatesCatalogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactElement;
  title?: string;
  description?: string;
  /** Opens on preview when the template is in the catalog cache. */
  initialTemplateId?: string | null;
  /** Limit gallery to newsletter or trigger blueprints. */
  audience?: CatalogTemplateAudience;
};

export function TemplatesCatalogDialog({
  open,
  onOpenChange,
  trigger,
  title = "Templates",
  description = "Browse ready-to-use templates and preview before you use them.",
  initialTemplateId = null,
  audience = "all",
}: TemplatesCatalogDialogProps) {
  const templatesCatalog = useTemplatesCatalog();
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<DialogStep>("gallery");
  const [selection, setSelection] = useState<StudioTemplate | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const previewEditorRef = useRef(null);

  const refreshCatalog = useCallback(async (force?: boolean) => {
    try {
      await templatesCatalog.refreshCatalog(force ? { force: true } : undefined);
    } catch {
      toast.error("Could not load templates");
    }
  }, [templatesCatalog]);

  function resetDialogState() {
    setSearch("");
    setStep("gallery");
    setSelection(null);
    setPreviewDevice("desktop");
    setPreviewHtml("");
  }

  function pickTemplate(template: StudioTemplate) {
    setSelection(template);
    setStep("preview");
    setPreviewHtml("");
  }

  function backToGallery() {
    setStep("gallery");
    setPreviewHtml("");
  }

  useEffect(() => {
    if (!open) return;
    resetDialogState();
    templatesCatalog.ensureCatalogLoaded();
  }, [open, templatesCatalog]);

  const { templates, resolvedLayouts: layouts } = templatesCatalog;
  const loadingCatalog = templatesCatalog.catalogShowPlaceholder;
  const refreshing = templatesCatalog.catalogRefreshing;

  useEffect(() => {
    if (!open || !initialTemplateId?.trim()) return;
    const match = templatesCatalog.getTemplate(initialTemplateId.trim());
    if (!match) return;
    pickTemplate(match);
  }, [open, initialTemplateId, templates, templatesCatalog]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byAudience = filterCatalogTemplatesByAudience(templates, audience);
    const sorted = [...byAudience].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    if (!q) return sorted;
    return sorted.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.subject.toLowerCase().includes(q) ||
        (row.category?.toLowerCase().includes(q) ?? false) ||
        row.id.toLowerCase().includes(q),
    );
  }, [templates, search, audience]);

  const { plainTextTemplate, previewSubject, renderedPreview, PREVIEW_RECIPIENT } =
    useCatalogTemplateRenderedPreview({
      template: selection,
      layouts,
      previewHtml,
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetDialogState();
      }}
    >
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="flex h-[min(88vh,820px)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3">
          {step === "gallery" ? (
            <>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </>
          ) : selection ? (
            <div className="flex items-start gap-2 pr-8">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="-ml-2 shrink-0"
                aria-label="Back to templates"
                onClick={backToGallery}
              >
                <ArrowLeft className="size-4" aria-hidden />
              </Button>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DialogTitle className="truncate text-sm font-semibold">{selection.name}</DialogTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                      aria-label="Desktop preview"
                      aria-pressed={previewDevice === "desktop"}
                      onClick={() => setPreviewDevice("desktop")}
                    >
                      <Monitor className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                      aria-label="Mobile preview"
                      aria-pressed={previewDevice === "mobile"}
                      onClick={() => setPreviewDevice("mobile")}
                    >
                      <Smartphone className="size-4" />
                    </Button>
                    <div className="ml-1">
                      <CatalogTemplateUseActions template={selection} />
                    </div>
                  </div>
                </div>
                {selection.subject ? (
                  <DialogDescription className="truncate">{selection.subject}</DialogDescription>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Sample recipient · {PREVIEW_RECIPIENT.email}
                </p>
              </div>
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {step === "gallery" ? (
            <>
              <div className="shrink-0 space-y-2 border-b px-4 py-3">
                <ListToolbar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search templates…"
                  trailing={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={refreshing || loadingCatalog}
                      onClick={() => void refreshCatalog(true)}
                    >
                      <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden />
                    </Button>
                  }
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {loadingCatalog && templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading templates…</p>
                ) : filteredTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {search.trim() ? "No templates match your search." : "No templates yet."}
                  </p>
                ) : (
                  <ul className={studioGalleryGridClassName}>
                    {filteredTemplates.map((template) => {
                      const layout = resolveTemplateLayout(template, layouts);
                      return (
                        <li key={template.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => pickTemplate(template)}
                            className="group flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/40 hover:shadow-sm"
                          >
                            <TemplateThumbnailPreview
                              templateId={template.id}
                              template={template}
                              layout={layout}
                              isPreset={isPresetCatalogTemplate(template.id)}
                            />
                            <div className="space-y-0.5 border-t px-3 py-2.5">
                              <p className="truncate text-sm font-medium">{template.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {catalogTemplateCardSubtitle(template)}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : selection ? (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              {!plainTextTemplate ? (
                <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
                  <MarkdownEditor
                    ref={previewEditorRef}
                    newsletterId={selection.id}
                    documentId={selection.id}
                    assetOwner="message"
                    value={selection.bodyMarkdown ?? ""}
                    editable={false}
                    onChange={({ html }) => setPreviewHtml(html)}
                  />
                </div>
              ) : null}

              <div
                className="min-h-0 flex-1 overflow-hidden bg-[#f6f8fc]"
                style={{ colorScheme: "light" }}
              >
                <NewsletterEmailPreview
                  subject={previewSubject}
                  fromName={null}
                  fromEmail="you@example.com"
                  toEmail={PREVIEW_RECIPIENT.email}
                  bodyHtml={renderedPreview}
                  bodyPlainText={renderedPreview}
                  previewIsPlainText={plainTextTemplate}
                  device={previewDevice}
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
