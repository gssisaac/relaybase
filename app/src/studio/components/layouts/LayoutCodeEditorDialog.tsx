"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { studioApi, StudioApiError, type StudioLayout } from "@/studio/api";

export function LayoutCodeEditorDialog({
  template,
  open,
  onOpenChange,
  onSaved,
}: {
  template: StudioLayout | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (result: { template: StudioLayout; forked: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [htmlSource, setHtmlSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !template) return;
    setName(template.name);
    setHtmlSource(template.htmlSource);
    setError(null);
    setSaving(false);
  }, [open, template?.id, template?.name, template?.htmlSource]);

  async function submit() {
    if (!template) return;
    if (!template.isBuiltin && !name.trim()) {
      setError("Template name is required");
      return;
    }
    if (!htmlSource.includes("{{content}}")) {
      setError("HTML must include a {{content}} placeholder");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { layout: saved, forked, warnings } = await studioApi.saveLayoutSource(template.id, {
        htmlSource,
        ...(template.isBuiltin ? {} : { name: name.trim() }),
      });
      if (warnings.length > 0) {
        toast.warning(warnings[0]);
      }
      toast.success(
        forked
          ? `Saved as custom template "${saved.name}"`
          : `Template "${saved.name}" updated`,
      );
      onSaved?.({ template: saved, forked });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof StudioApiError ? e.message : "Save failed");
      setSaving(false);
    }
  }

  if (!template) return null;

  const isCustom = !template.isBuiltin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCustom ? "Edit custom template" : `${template.name} — HTML`}</DialogTitle>
          <DialogDescription>
            {template.isBuiltin
              ? "Built-in templates are read-only here. Saving creates a custom copy you can keep editing."
              : "Update the template name and HTML. Changes apply immediately."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-1">
          {isCustom ? (
            <div className="space-y-1.5">
              <Label htmlFor="tpl-code-name">Name</Label>
              <Input
                id="tpl-code-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={examplePlaceholder("My newsletter layout")}
                autoComplete="off"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-code-editor">HTML source</Label>
            <Textarea
              id="tpl-code-editor"
              value={htmlSource}
              onChange={(e) => setHtmlSource(e.target.value)}
              className="min-h-[min(420px,50vh)] font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void submit()}>
            {saving ? "Saving…" : template.isBuiltin ? "Save as custom copy" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
