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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { crmApi, CrmApiError, type CrmTemplate } from "@/lib/crm/api";

export function CrmTemplateCodeEditorDialog({
  template,
  open,
  onOpenChange,
  onSaved,
}: {
  template: CrmTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (result: { template: CrmTemplate; forked: boolean }) => void;
}) {
  const [htmlSource, setHtmlSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !template) return;
    setHtmlSource(template.htmlSource);
    setError(null);
    setSaving(false);
  }, [open, template?.id, template?.htmlSource]);

  async function submit() {
    if (!template) return;
    if (!htmlSource.includes("{{content}}")) {
      setError("HTML must include a {{content}} placeholder");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { template: saved, forked, warnings } = await crmApi.saveTemplateSource(template.id, {
        htmlSource,
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
      setError(e instanceof CrmApiError ? e.message : "Save failed");
      setSaving(false);
    }
  }

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template.name} — HTML</DialogTitle>
          <DialogDescription>
            {template.isBuiltin
              ? "Built-in templates are read-only here. Saving creates a custom copy you can keep editing."
              : "Changes apply to this custom template immediately."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-1">
          <Label htmlFor="tpl-code-editor" className="sr-only">
            HTML source
          </Label>
          <Textarea
            id="tpl-code-editor"
            value={htmlSource}
            onChange={(e) => setHtmlSource(e.target.value)}
            className="min-h-[min(420px,50vh)] font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
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
