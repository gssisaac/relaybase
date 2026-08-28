"use client";

import { useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkerUrlInputDialog } from "@/console/components/setup/WorkerUrlInputDialog";
import {
  loadRecentWorkerUrls,
  mergeRecentWorkerUrls,
} from "@/lib/desktop/worker-url/recent-worker-urls";
import { normalizeWorkerUrl } from "@/lib/desktop/worker-url/worker-url";

const ENTER_WORKER_URL = "__enter_worker_url__";

type WorkerUrlPickerProps = {
  value: string;
  onChange: (url: string) => void;
  seedUrls?: Array<string | undefined | null>;
  disabled?: boolean;
};

/**
 * Recent Worker URLs as a select, plus "Enter worker URL" dialog entry.
 * Used on passtoken / team login forms.
 */
export function WorkerUrlPicker({
  value,
  onChange,
  seedUrls = [],
  disabled = false,
}: WorkerUrlPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSeeds, setDialogSeeds] = useState<string[]>([]);

  const recentUrls = useMemo(
    () => mergeRecentWorkerUrls(...seedUrls, ...loadRecentWorkerUrls()),
    [seedUrls],
  );

  const options = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    const normalizedValue = normalizeWorkerUrl(value);
    for (const url of [normalizedValue, ...recentUrls, ...dialogSeeds]) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      merged.push(url);
    }
    return merged;
  }, [recentUrls, value, dialogSeeds]);

  const selectedUrl = normalizeWorkerUrl(value);

  function handleValueChange(next: string | null) {
    if (!next || next === ENTER_WORKER_URL) {
      if (next === ENTER_WORKER_URL) {
        setDialogOpen(true);
      }
      return;
    }
    onChange(next);
  }

  function handleConfirm(url: string) {
    const normalized = normalizeWorkerUrl(url);
    if (!normalized) return;
    setDialogSeeds((prev) =>
      prev.includes(normalized) ? prev : [normalized, ...prev],
    );
    onChange(normalized);
  }

  return (
    <div className="space-y-2">
      <Label>Worker URL</Label>

      <Select
        value={selectedUrl || null}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full font-mono text-xs">
          <SelectValue placeholder="Select Worker URL" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ENTER_WORKER_URL}>Enter worker URL</SelectItem>
          {options.map((url) => (
            <SelectItem key={url} value={url} className="font-mono text-xs">
              {url}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <WorkerUrlInputDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialUrl={selectedUrl}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
