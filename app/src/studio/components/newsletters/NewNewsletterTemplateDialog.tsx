"use client";

import { ArrowLeft, FilePlus2, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
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
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";
import { NewsletterEmailPreview } from "@/studio/components/newsletters/NewsletterEmailPreview";
import { resolveTemplateLayout } from "@/studio/components/templates/TemplateThumbnailGrid";
import { TemplateThumbnailPreview } from "@/studio/components/templates/TemplateThumbnailPreview";
import { ListToolbar } from "@/email/components/mailbox/EmailListShell";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { newsletterDetailHref } from "@/studio/lib/paths";
import { catalogTemplateSnapshot } from "@/studio/lib/templates/catalog-template-snapshot";
import { createNewsletterFromHubTemplate } from "@/studio/lib/templates/hub-template-launch";
import { newslettersHubStore } from "@/studio/stores/newsletters-hub";
import { useTemplatesCatalog } from "@/studio/stores/templates-catalog";
import { useCatalogTemplateRenderedPreview } from "@/studio/lib/templates/use-catalog-template-rendered-preview";
import { studioApi, StudioApiError, type StudioTemplate } from "@/studio/api";
import { studioGalleryGridClassName } from "@/studio/lib/gallery/studio-gallery-grid";
import { cn } from "@/lib/utils";

export type NewsletterTemplatePick = StudioTemplate | "blank";

type DialogStep = "gallery" | "preview";

type NewNewsletterTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactElement;
};

export function NewNewsletterTemplateDialog({
  open,
  onOpenChange,
  trigger,
}: NewNewsletterTemplateDialogProps) {
  const router = useRouter();
  const templatesCatalog = useTemplatesCatalog();
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<DialogStep>("gallery");
  const [selection, setSelection] = useState<NewsletterTemplatePick | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const previewEditorRef = useRef(null);

  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refreshCatalog = useCallback(async (force?: boolean) => {
    try {
      await templatesCatalog.refreshCatalog(force ? { force: true } : undefined);
    } catch {
      toast.error("Could not load templates");
    }
  }, [templatesCatalog]);

  function resetForm() {
    setSearch("");
    setStep("gallery");
    setSelection(null);
    setPreviewDevice("desktop");
    setPreviewHtml("");
    setFormError(null);
    setCreating(false);
  }

  function pickTemplate(next: StudioTemplate) {
    setSelection(next);
    setStep("preview");
    setPreviewHtml("");
    setFormError(null);
  }

  function displaySubject(subject: string | null | undefined, fallback = "(No subject)") {
    const trimmed = subject?.trim();
    return trimmed || fallback;
  }

  function backToGallery() {
    setStep("gallery");
    setPreviewHtml("");
    setFormError(null);
  }

  useEffect(() => {
    if (!open) return;
    resetForm();
    templatesCatalog.ensureCatalogLoaded();
  }, [open, templatesCatalog]);

  const { templates, resolvedLayouts: layouts } = templatesCatalog;
  const loadingCatalog = templatesCatalog.catalogShowPlaceholder;
  const refreshing = templatesCatalog.catalogRefreshing;

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...templates].sort(
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
  }, [templates, search]);

  const templateSelected = selection && selection !== "blank" ? selection : null;

  const { plainTextTemplate, previewSubject, renderedPreview, PREVIEW_RECIPIENT } =
    useCatalogTemplateRenderedPreview({
      template: templateSelected,
      layouts,
      previewHtml,
    });

  async function handleCreate(override?: NewsletterTemplatePick) {
    const picked = override ?? selection;
    if (!picked) return;

    setCreating(true);
    setFormError(null);
    try {
      const workerUrl = resolveEmailApiBase();
      if (picked === "blank") {
        const created = await studioApi.createNewsletter({
          ...(workerUrl ? { workerUrl } : {}),
        });
        toast.success("Newsletter created");
        newslettersHubStore.upsertNewsletter(created);
        void newslettersHubStore.refreshList();
        onOpenChange(false);
        router.push(newsletterDetailHref(created.id, "content"));
        return;
      }

      const created = await createNewsletterFromHubTemplate({
        hubTemplateId: picked.id,
        snapshot: catalogTemplateSnapshot(picked),
      });
      toast.success("Newsletter created");
      newslettersHubStore.upsertNewsletter(created);
      void newslettersHubStore.refreshList();
      onOpenChange(false);
      router.push(newsletterDetailHref(created.id, "content"));
    } catch (err) {
      setFormError(err instanceof StudioApiError ? err.message : "Could not create newsletter");
    } finally {
      setCreating(false);
    }
  }

  const canCreate = step === "preview" && selection !== null && !creating;

  const previewSubjectLine = templateSelected
    ? displaySubject(templateSelected.subject)
    : "(No subject)";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="flex h-[min(88vh,820px)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3">
          {step === "gallery" ? (
            <>
              <DialogTitle>New newsletter</DialogTitle>
              <DialogDescription>
                Pick a template to start. Name and audience can be set later in settings.
              </DialogDescription>
            </>
          ) : (
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
                  <DialogTitle className="truncate text-sm font-semibold">{previewSubjectLine}</DialogTitle>
                  {templateSelected ? (
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
                    </div>
                  ) : null}
                </div>
                {templateSelected?.category ? (
                  <DialogDescription className="truncate">
                    {templateSelected.category.replaceAll("_", " ")}
                  </DialogDescription>
                ) : null}
                {templateSelected ? (
                  <p className="text-xs text-muted-foreground">
                    Sample recipient · {PREVIEW_RECIPIENT.email}
                  </p>
                ) : null}
              </div>
            </div>
          )}
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
                ) : (
                  <ul className={studioGalleryGridClassName}>
                    {!search.trim() ? (
                      <li className="min-w-0">
                        <button
                          type="button"
                          disabled={creating}
                          onClick={() => void handleCreate("blank")}
                          className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/40 hover:shadow-sm disabled:pointer-events-none disabled:opacity-60"
                        >
                          <div className="flex aspect-[640/452] w-full flex-col items-center justify-center gap-2 bg-muted/30">
                            <FilePlus2 className="size-8 text-muted-foreground" aria-hidden />
                            <span className="text-xs font-medium text-muted-foreground">
                              {creating ? "Creating…" : "Blank newsletter"}
                            </span>
                          </div>
                          <div className="space-y-0.5 border-t px-3 py-2.5">
                            <p className="truncate text-sm font-medium">(No subject)</p>
                            <p className="truncate text-xs text-muted-foreground">Start from scratch</p>
                          </div>
                        </button>
                      </li>
                    ) : null}
                    {filteredTemplates.length === 0 && search.trim() ? (
                      <li className="col-span-full">
                        <p className="text-sm text-muted-foreground">No templates match your search.</p>
                      </li>
                    ) : (
                      filteredTemplates.map((template) => {
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
                                isPreset
                              />
                              <div className="space-y-0.5 border-t px-3 py-2.5">
                                <p className="truncate text-sm font-medium">
                                  {displaySubject(template.subject, template.name)}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {template.category?.replaceAll("_", " ") ?? "Catalog"}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              {templateSelected && !plainTextTemplate ? (
                <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
                  <MarkdownEditor
                    ref={previewEditorRef}
                    newsletterId={templateSelected.id}
                    documentId={templateSelected.id}
                    assetOwner="message"
                    value={templateSelected.bodyMarkdown ?? ""}
                    editable={false}
                    onChange={({ html }) => setPreviewHtml(html)}
                  />
                </div>
              ) : null}

              <div
                className="min-h-0 flex-1 overflow-hidden bg-[#f6f8fc]"
                style={{ colorScheme: "light" }}
              >
                {templateSelected ? (
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
                ) : null}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 flex-row items-center justify-end gap-2 border-t bg-background px-4 py-3">
          {formError ? <p className="mr-auto text-xs text-destructive">{formError}</p> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={creating}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canCreate}
            onClick={() => void handleCreate()}
          >
            {creating ? "Creating…" : "Create newsletter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
