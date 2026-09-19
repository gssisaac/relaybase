"use client";

import { ArrowLeft, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { toast } from "sonner";

import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import { Button } from "@/components/ui/button";
import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListToolbar } from "@/email/components/mailbox/EmailListShell";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { cn } from "@/lib/utils";
import { StudioApiError, type StudioTemplate, type TriggerPurpose } from "@/studio/api";
import { isPresetCatalogTemplate } from "@/studio/lib/messages/message-library";
import { NewsletterEmailPreview } from "@/studio/components/newsletters/NewsletterEmailPreview";
import { resolveTemplateLayout } from "@/studio/components/templates/TemplateThumbnailGrid";
import { TemplateThumbnailPreview } from "@/studio/components/templates/TemplateThumbnailPreview";
import { studioGalleryGridClassName } from "@/studio/lib/gallery/studio-gallery-grid";
import { triggerDetailHref } from "@/studio/lib/paths";
import {
  catalogTemplateCardSubtitle,
  filterCatalogTemplatesByAudience,
  triggerPurposeFromCatalogTemplate,
} from "@/studio/lib/templates/catalog-template-audience";
import { catalogTemplateSnapshot } from "@/studio/lib/templates/catalog-template-snapshot";
import { createTriggerFromHubTemplate } from "@/studio/lib/templates/hub-template-launch";
import { useCatalogTemplateRenderedPreview } from "@/studio/lib/templates/use-catalog-template-rendered-preview";
import { triggersHubStore } from "@/studio/stores/triggers-hub";
import { useTemplatesCatalog } from "@/studio/stores/templates-catalog";

type DialogStep = "gallery" | "preview";

const TRIGGER_PURPOSE_OPTIONS: { value: TriggerPurpose; label: string }[] = [
  { value: "transactional", label: "Transactional" },
  { value: "conversational", label: "Conversational" },
  { value: "marketing", label: "Marketing" },
];

type NewTriggerTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (triggerId: string) => void;
  trigger?: ReactElement;
};

export function NewTriggerTemplateDialog({
  open,
  onOpenChange,
  onCreated,
  trigger,
}: NewTriggerTemplateDialogProps) {
  const router = useRouter();
  const templatesCatalog = useTemplatesCatalog();
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<DialogStep>("gallery");
  const [selection, setSelection] = useState<StudioTemplate | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const previewEditorRef = useRef(null);

  const [triggerName, setTriggerName] = useState("");
  const [senderEmail, setSenderEmail] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<TriggerPurpose>("transactional");
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
    setTriggerName("");
    setSenderEmail(null);
    setDomain(null);
    setPurpose("transactional");
    setFormError(null);
    setCreating(false);
  }

  function pickTemplate(template: StudioTemplate) {
    setSelection(template);
    setStep("preview");
    setPreviewHtml("");
    setTriggerName(template.name.trim() || template.subject.trim());
    setPurpose(triggerPurposeFromCatalogTemplate(template));
    setFormError(null);
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
    const audienceFiltered = filterCatalogTemplatesByAudience(templates, "trigger");
    const sorted = [...audienceFiltered].sort(
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

  const { plainTextTemplate, previewSubject, renderedPreview, PREVIEW_RECIPIENT } =
    useCatalogTemplateRenderedPreview({
      template: selection,
      layouts,
      previewHtml,
    });

  async function handleCreate() {
    if (!selection) return;
    const name = triggerName.trim();
    const sendingDomain = domain?.trim().toLowerCase();
    if (!name) {
      setFormError("Trigger name is required");
      return;
    }
    if (!sendingDomain) {
      setFormError("Select a sending account");
      return;
    }

    setCreating(true);
    setFormError(null);
    try {
      const created = await createTriggerFromHubTemplate({
        name,
        domain: sendingDomain,
        purpose,
        hubTemplateId: selection.id,
        snapshot: catalogTemplateSnapshot(selection),
      });
      triggersHubStore.upsertTrigger(created);
      toast.success(`Trigger “${created.name}” created`);
      onOpenChange(false);
      if (onCreated) {
        onCreated(created.id);
      } else {
        router.push(triggerDetailHref(created.id, "config", created.status));
      }
    } catch (err) {
      setFormError(err instanceof StudioApiError ? err.message : "Could not create trigger");
    } finally {
      setCreating(false);
    }
  }

  const canCreate = step === "preview" && selection !== null && !creating;

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
              <DialogTitle>New trigger from template</DialogTitle>
              <DialogDescription>
                Automation and transactional blueprints — password resets, welcome flows, and
                inbound auto-replies.
              </DialogDescription>
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
                <DialogTitle className="truncate text-sm font-semibold">{selection.name}</DialogTitle>
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
              <div className="shrink-0 border-b px-4 py-3">
                <ListToolbar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search trigger templates…"
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
                  <p className="text-sm text-muted-foreground">No trigger templates match your search.</p>
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
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              <div className="relative min-h-0 flex-1 overflow-hidden border-b lg:border-b-0 lg:border-r">
                {selection && !plainTextTemplate ? (
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
                <div className="flex items-center justify-end gap-1 border-b px-3 py-2">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                    aria-label="Desktop preview"
                    onClick={() => setPreviewDevice("desktop")}
                  >
                    <Monitor className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                    aria-label="Mobile preview"
                    onClick={() => setPreviewDevice("mobile")}
                  >
                    <Smartphone className="size-4" />
                  </Button>
                </div>
                <div
                  className="min-h-[240px] flex-1 overflow-hidden bg-[#f6f8fc] lg:min-h-0"
                  style={{ colorScheme: "light" }}
                >
                  {selection ? (
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
              <div className="w-full shrink-0 space-y-3 overflow-y-auto px-4 py-4 lg:w-80">
                <div className="space-y-1.5">
                  <Label htmlFor="trigger-template-name">Name</Label>
                  <Input
                    id="trigger-template-name"
                    value={triggerName}
                    onChange={(e) => setTriggerName(e.target.value)}
                    placeholder={examplePlaceholder("Verify Email")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Purpose</Label>
                  <CmdDropdown
                    triggerClassName="min-w-0"
                    value={purpose}
                    enableSearch={false}
                    options={TRIGGER_PURPOSE_OPTIONS}
                    onValueChange={(v) => {
                      if (v === "transactional" || v === "conversational" || v === "marketing") {
                        setPurpose(v);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trigger-template-sender">Sending account</Label>
                  <AccountCmdDropdown
                    triggerId="trigger-template-sender"
                    value={senderEmail}
                    onValueChange={(email, ctx) => {
                      setSenderEmail(email ?? null);
                      setDomain(ctx?.domain ?? null);
                    }}
                  />
                </div>
                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 flex-row items-center justify-end gap-2 border-t bg-background px-4 py-3">
          <Button type="button" variant="outline" size="sm" disabled={creating} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === "preview" ? (
            <Button type="button" size="sm" disabled={!canCreate} onClick={() => void handleCreate()}>
              {creating ? "Creating…" : "Create trigger"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
