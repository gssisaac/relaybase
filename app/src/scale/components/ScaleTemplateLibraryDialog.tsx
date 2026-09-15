"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScaleTemplateImportDialog } from "@/scale/components/ScaleTemplateImportDialog";
import { scaleApi, type ScaleTemplate } from "@/lib/scale/api";

export function ScaleTemplateLibraryDialog({
  trigger,
}: {
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [templates, setTemplates] = useState<ScaleTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { templates: rows } = await scaleApi.listTemplates();
      setTemplates(rows);
    } catch {
      toast.error("Could not load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={trigger} />
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email templates</DialogTitle>
            <DialogDescription>
              Built-in layouts plus custom HTML imports. Broadcasts pick a template on the Content
              tab.
            </DialogDescription>
          </DialogHeader>
          <div className="flex shrink-0 justify-end">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              Import HTML
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="py-4 text-sm text-muted-foreground">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No templates</p>
            ) : (
              <ul className="divide-y divide-border">
                {templates.map((t) => (
                  <li key={t.id} className="py-3">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.isBuiltin ? "Built-in" : "Custom"} · {t.id}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ScaleTemplateImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void load()}
      />
    </>
  );
}
