"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";
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
import { LayoutImportDialog } from "@/studio/components/layouts/LayoutImportDialog";
import { studioApi, type StudioLayout } from "@/studio/api";

export function LayoutLibraryDialog({
  trigger,
}: {
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [templates, setTemplates] = useState<StudioLayout[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { layouts: rows } = await studioApi.listLayouts();
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
            <DialogTitle>Layouts</DialogTitle>
            <DialogDescription>
              HTML email frames. Message copy lives in Templates; newsletters and triggers pick a layout
              on the Content tab.
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
      <LayoutImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void load()}
      />
    </>
  );
}
