"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WorkerUrlInputDialog } from "@/console/components/setup/WorkerUrlInputDialog";
import {
  loadRecentWorkerUrls,
  mergeRecentWorkerUrls,
} from "@/lib/desktop/worker-url/recent-worker-urls";
import { cn } from "@/lib/utils";

type WorkerUrlPickerProps = {
  value: string;
  onChange: (url: string) => void;
  seedUrls?: Array<string | undefined | null>;
  disabled?: boolean;
};

/**
 * Recent Worker URLs plus manual entry (dialog). Used on passtoken / team login forms.
 */
export function WorkerUrlPicker({
  value,
  onChange,
  seedUrls = [],
  disabled = false,
}: WorkerUrlPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const recentUrls = useMemo(
    () => mergeRecentWorkerUrls(...seedUrls, ...loadRecentWorkerUrls()),
    [seedUrls],
  );

  return (
    <div className="space-y-2">
      <Label>Worker URL</Label>

      {recentUrls.length > 0 ? (
        <ul className="space-y-1.5" role="listbox" aria-label="Recent Worker URLs">
          {recentUrls.map((url) => {
            const selected = value === url;
            return (
              <li key={url}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left font-mono text-xs transition-colors",
                    selected
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    disabled && "pointer-events-none opacity-50",
                  )}
                  onClick={() => onChange(url)}
                >
                  {url}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No recent Worker URLs yet. Enter one manually below.
        </p>
      )}

      {value && !recentUrls.includes(value) ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 font-mono text-xs">
          {value}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={disabled}
        onClick={() => setDialogOpen(true)}
      >
        <Plus className="size-3.5" />
        Enter URL manually
      </Button>

      <WorkerUrlInputDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialUrl={value}
        onConfirm={onChange}
      />
    </div>
  );
}
