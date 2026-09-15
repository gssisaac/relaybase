"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { layoutDetailHref } from "@/scale/lib/layout-paths";
import { prepareLayoutTemplateHtml } from "@/scale/lib/layouts/layout-standard-footer";
import { useScalePaths } from "@/scale/lib/paths";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { scaleApi, ScaleApiError, type ScaleLayout } from "@/lib/scale/api";
import { cn } from "@/lib/utils";

const SAMPLE_BODY_HTML =
  "<p style='margin:0 0 12px;font-family:sans-serif;font-size:15px;line-height:1.5;color:#334155'>Sample message body — merge tags and markdown render here in campaigns.</p>";

export function LayoutDetailView({ layoutId }: { layoutId: string }) {
  const router = useRouter();
  const { layouts: layoutsPath } = useScalePaths();
  const [row, setRow] = useState<ScaleLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [htmlSource, setHtmlSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { layout } = await scaleApi.getLayout(layoutId);
      setRow(layout);
      setName(layout.name);
      setHtmlSource(layout.htmlSource);
      setError(null);
    } catch (e) {
      setRow(null);
      if (e instanceof ScaleApiError && e.status === 404) {
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

  const previewHtml = useMemo(() => {
    if (!row) return "";
    const shell = prepareLayoutTemplateHtml(htmlSource, row.id);
    return shell.replaceAll("{{content}}", SAMPLE_BODY_HTML);
  }, [htmlSource, row]);

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
      const { layout: saved, forked, warnings } = await scaleApi.saveLayoutSource(row.id, {
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
      setError(e instanceof ScaleApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!row || row.isBuiltin) return;
    setDeleting(true);
    try {
      await scaleApi.deleteLayout(row.id);
      toast.success("Layout deleted");
      router.push(layoutsPath);
    } catch (e) {
      toast.error(e instanceof ScaleApiError ? e.message : "Could not delete layout");
      setDeleting(false);
    }
  }

  if (loading && !row) {
    return <p className="p-4 text-sm text-muted-foreground">Loading layout…</p>;
  }

  if (!row) {
    return (
      <div className="p-4 text-sm">
        Layout not found.{" "}
        <Link href={layoutsPath} className="text-primary underline-offset-4 hover:underline">
          Back to layouts
        </Link>
      </div>
    );
  }

  const isCustom = !row.isBuiltin;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-2"
        end={
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
                      This removes &quot;{row.name}&quot; permanently. Message templates still
                      using this frame must be updated first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void remove()}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : row.isBuiltin ? "Save as custom copy" : "Save"}
            </Button>
          </div>
        }
      >
        <Link href={layoutsPath} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Layouts
        </Link>
        <span className="truncate text-sm font-medium">{row.name}</span>
      </DesktopTitleBar>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto border-b border-border p-4 lg:border-b-0 lg:border-r">
          <p className="text-xs text-muted-foreground">
            {row.isBuiltin
              ? "Built-in layouts are read-only — saving creates a custom copy you can edit and delete."
              : "Update the frame HTML. Campaigns and templates reference this layout by id."}
          </p>
          {isCustom ? (
            <div className="space-y-1.5">
              <Label htmlFor="layout-name">Name</Label>
              <Input
                id="layout-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={examplePlaceholder("Company newsletter")}
              />
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
            <Label htmlFor="layout-html">HTML source</Label>
            <Textarea
              id="layout-html"
              value={htmlSource}
              onChange={(e) => setHtmlSource(e.target.value)}
              className="min-h-[min(480px,55vh)] flex-1 font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f6f8fc]">
          <div className="shrink-0 border-b border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground">
            Preview (sample body)
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div
              className="mx-auto max-w-[600px] overflow-hidden rounded-md border border-border bg-white shadow-sm"
              style={{ colorScheme: "light" }}
            >
              <iframe
                title="Layout preview"
                className="h-[min(640px,70vh)] w-full border-0 bg-white"
                sandbox=""
                srcDoc={previewHtml}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
