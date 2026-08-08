"use client";

import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { useDomain } from "@/lib/dashboard/DomainContext";
import { desktopListZones, isDesktopRuntime, type ZoneSummary } from "@/lib/desktop/bridge";
import { Button } from "@/components/ui/button";
import { FieldCheck } from "@/components/ui/field-check";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Desktop-only: list zones from the user's own Cloudflare account and queue
 * them for onboarding (no Relaybase nameserver hand-off).
 */
export function ImportCloudflareZonesDialog() {
  const store = useDomain();
  const [open, setOpen] = useState(false);
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open || !isDesktopRuntime()) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await desktopListZones();
        setZones(list);
        const existing = new Set(store.domains.map((d) => d.domain));
        const next: Record<string, boolean> = {};
        for (const z of list) {
          if (!existing.has(z.name)) next[z.name] = false;
        }
        setSelected(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to list zones");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, store.domains]);

  if (!isDesktopRuntime()) return null;

  async function handleImport() {
    const names = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([name]) => name);
    if (names.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      for (const name of names) {
        await store.addDomain(name);
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          <Plus className="size-3.5" />
          Import from Cloudflare
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import zones from your account</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Domains already on your Cloudflare account — we never ask you to point
          nameservers at Relaybase.
        </p>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading zones…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : zones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No zones found.</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {zones.map((z) => {
              const already = store.domains.some((d) => d.domain === z.name);
              return (
                <FieldCheck
                  key={z.id}
                  id={`zone-${z.id}`}
                  checked={already ? true : Boolean(selected[z.name])}
                  disabled={already || importing}
                  onCheckedChange={(on) =>
                    setSelected((prev) => ({ ...prev, [z.name]: on }))
                  }
                  label={`${z.name}${already ? " (already added)" : ""} · ${z.status}`}
                />
              );
            })}
          </div>
        )}
        <Button
          className="w-full"
          disabled={importing || loading}
          onClick={() => void handleImport()}
        >
          {importing ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Add selected
        </Button>
      </DialogContent>
    </Dialog>
  );
}
