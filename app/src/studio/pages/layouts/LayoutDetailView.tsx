"use client";

import Link from "next/link";
import { Monitor, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { LayoutHtmlCodeEditor } from "@/studio/components/layouts/LayoutHtmlCodeEditor";
import { StudioDetailPageHeader } from "@/studio/components/StudioDetailPageHeader";
import { NewsletterEmailPreview } from "@/studio/components/newsletters/NewsletterEmailPreview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { layoutDetailHref } from "@/studio/lib/layouts/layout-paths";
import { useLayoutRenderedPreview } from "@/studio/pages/layouts/use-layout-rendered-preview";
import { useStudioPaths } from "@/studio/lib/paths";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { studioApi, StudioApiError, type StudioLayout } from "@/studio/api";

export function LayoutDetailView({ layoutId }: { layoutId: string }) {
  const router = useRouter();
  const { layouts: layoutsPath } = useStudioPaths();
  const [row, setRow] = useState<StudioLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [htmlSource, setHtmlSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { layout } = await studioApi.getLayout(layoutId);
      setRow(layout);
      setName(layout.name);
      setHtmlSource(layout.htmlSource);
      setError(null);
    } catch (e) {
      setRow(null);
      if (e instanceof StudioApiError && e.status === 404) {
        toast.error("Layout not found");
      } else {
        toast.error("Could not load layout");
      }
    } finally {
      setLoading(false);
    }
  }, [layoutId]);

  useEffect(() => {
    void load();
  }, [load]);

  const { renderedPreview, plainTextTemplate, previewRecipientEmail, previewFromEmail } =
    useLayoutRenderedPreview({
      layoutId: row?.id ?? layoutId,
      htmlSource,
      variablesSchema: row?.variablesSchema,
    });

  async function save() {
    if (!row) return;
    if (!row.isBuiltin && !name.trim()) {
      setError("Layout name is required");
      return;
    }
    if (!htmlSource.includes("{{content}}")) {
      setError("HTML must include a {{content}} placeholder");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { layout: saved, forked, warnings } = await studioApi.saveLayoutSource(row.id, {
        htmlSource,
        ...(row.isBuiltin ? {} : { name: name.trim() }),
      });
      if (warnings.length > 0) toast.warning(warnings[0]!);
      if (forked) {
        toast.success(`Saved as custom layout "${saved.name}"`);
        router.replace(layoutDetailHref(saved.id));
        setRow(saved);
        setName(saved.name);
        setHtmlSource(saved.htmlSource);
      } else {
        toast.success("Layout saved");
        setRow(saved);
        setName(saved.name);
        setHtmlSource(saved.htmlSource);
      }
    } catch (e) {
      setError(e instanceof StudioApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!row || row.isBuiltin) return;
    setDeleting(true);
    try {
      await studioApi.deleteLayout(row.id);
      toast.success("Layout deleted");
      router.push(layoutsPath);
    } catch (e) {
      toast.error(e instanceof StudioApiError ? e.message : "Could not delete layout");
      setDeleting(false);
    }
  }

  if (loading && !row) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <StudioDetailPageHeader backHref={layoutsPath} backLabel="Back to layouts" title="Loading…" />
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          Loading layout…
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <StudioDetailPageHeader
          backHref={layoutsPath}
          backLabel="Back to layouts"
          title="Layout not found"
        />
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          This layout does not exist or was removed.{" "}
          <Link href={layoutsPath} className="text-primary underline-offset-4 hover:underline">
            Back to layouts
          </Link>
        </div>
      </div>
    );
  }

  const isCustom = !row.isBuiltin;
  const headerActions = (
    <div className="flex items-center gap-2">
      {isCustom ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button size="sm" variant="outline" disabled={deleting}>
                Delete
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete layout?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes &quot;{row.name}&quot; permanently. Message templates still using this
                frame must be updated first.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      <Button size="sm" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : row.isBuiltin ? "Save as custom copy" : "Save"}
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <StudioDetailPageHeader
        backHref={layoutsPath}
        backLabel="Back to layouts"
        title={row.name.trim() || "Untitled layout"}
        end={headerActions}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            {isCustom ? (
              <>
                <Label htmlFor="layout-name" className="sr-only">
                  Layout name
                </Label>
                <Input
                  id="layout-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={examplePlaceholder("Company newsletter")}
                  className="h-8 max-w-[min(100%,14rem)] shrink-0 text-xs"
                />
              </>
            ) : null}
            <p className="min-w-0 flex-1 text-right text-[11px] leading-snug text-muted-foreground">
              {row.isBuiltin
                ? "Built-in · Save forks an editable copy"
                : "Frame HTML · referenced by id"}
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pt-2">
            <LayoutHtmlCodeEditor
              id="layout-html"
              value={htmlSource}
              onChange={setHtmlSource}
            />
            {error ? <p className="mt-2 shrink-0 text-xs text-destructive">{error}</p> : null}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex shrink-0 items-center justify-center border-b border-border px-3 py-2">
            <div className="flex items-center gap-0.5">
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
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f6f8fc]"
            style={{ colorScheme: "light" }}
          >
            <NewsletterEmailPreview
              subject="Sample layout preview"
              fromName={null}
              fromEmail={previewFromEmail}
              toEmail={previewRecipientEmail}
              bodyHtml={renderedPreview}
              bodyPlainText={renderedPreview}
              previewIsPlainText={plainTextTemplate}
              device={device}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
