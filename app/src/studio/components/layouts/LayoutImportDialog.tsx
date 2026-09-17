"use client";

import { useState } from "react";
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
import { STANDARD_COMPLIANCE_FOOTER_HTML_APPEND } from "@/studio/lib/layouts/layout-standard-footer";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { studioApi, StudioApiError } from "@/studio/api";

export function LayoutImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (templateId: string) => void;
}) {
  const [name, setName] = useState("");
  const [htmlSource, setHtmlSource] = useState(
    `<table width="100%"><tr><td>{{content}}</td></tr></table>\n${STANDARD_COMPLIANCE_FOOTER_HTML_APPEND}`,
  );
  const [variablesYaml, setVariablesYaml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setVariablesYaml("");
    setError(null);
    setSaving(false);
  }

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
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
      const { layout, warnings } = await studioApi.importLayout({
        name: trimmedName,
        htmlSource,
        variablesYaml: variablesYaml.trim() || undefined,
      });
      if (warnings.length > 0) {
        toast.warning(warnings[0]);
      }
      toast.success(`Template "${layout.name}" imported`);
      onImported?.(layout.id);
      onOpenChange(false);
      reset();
    } catch (e) {
      setError(e instanceof StudioApiError ? e.message : "Import failed");
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import HTML template</DialogTitle>
          <DialogDescription>
            Wrap your layout around {"{{content}}"} and include {"{{unsubscribe_url}}"} in the
            footer when possible.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-1">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={examplePlaceholder("Company newsletter")}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-vars">Variable schema (YAML, optional)</Label>
            <Textarea
              id="tpl-vars"
              value={variablesYaml}
              onChange={(e) => setVariablesYaml(e.target.value)}
              placeholder={`fields:\n  - key: header.logo\n    type: image\n    label: Logo`}
              className="min-h-[100px] font-mono text-xs"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-html">HTML source</Label>
            <Textarea
              id="tpl-html"
              value={htmlSource}
              onChange={(e) => setHtmlSource(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
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
            {saving ? "Importing…" : "Import template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
