"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useOpenEnableEmailApiDialog } from "@/console/components/setup/use-enable-email-api-dialog";
import { useDomain } from "@/lib/dashboard/DomainContext";
import {
  desktopListZones,
  explainDesktopError,
  isCloudflareAuthExpired,
  isDesktopRuntime,
  type DesktopErrorHelp,
  type ZoneSummary,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/shell";
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
 * Desktop-only: list zones from the user's Cloudflare account and queue
 * selected ones for background onboarding.
 */
export function ImportCloudflareZonesDialog({
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
} = {}) {
  const store = useDomain();
  const openEnableEmailApiDialog = useOpenEnableEmailApiDialog();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [authExpired, setAuthExpired] = useState(false);

  const loadZones = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    setError(null);
    setAuthExpired(false);
    try {
      const list = await desktopListZones();
      const existing = new Set(
        store.domains.map((d) => d.domain.trim().toLowerCase()),
      );
      const missing = list.filter(
        (z) => !existing.has(z.name.trim().toLowerCase()),
      );
      setZones(missing);
      const next: Record<string, boolean> = {};
      for (const z of missing) {
        next[z.name] = true;
      }
      setSelected(next);
    } catch (err) {
      const expired = isCloudflareAuthExpired(err);
      setAuthExpired(expired);
      // Expired session is expected after the app restarts — reconnect, don't
      // treat it as a failure.
      setError(expired ? null : explainDesktopError(err, "Failed to list zones"));
      setZones([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }, [store.domains]);

  useEffect(() => {
    if (!open || !isDesktopRuntime()) return;
    void loadZones();
  }, [open, loadZones]);

  if (!isDesktopRuntime()) return null;

  const selectedNames = Object.entries(selected)
    .filter(([, on]) => on)
    .map(([name]) => name);
  const canSubmit = !loading && selectedNames.length > 0;

  function handleImport() {
    if (selectedNames.length === 0) return;
    store.queueAddDomains(selectedNames, true);
    setOpen(false);
    setError(null);
    setAuthExpired(false);
  }

  function handleEnableEmailApi() {
    openEnableEmailApiDialog({
      onVerified: () => {
        void loadZones();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger render={<Button size="sm" />}>
          <RefreshCw className="size-3.5" />
          Refresh from Cloudflare
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refresh zones from Cloudflare</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          New domains on your Cloudflare account that are not in Relaybase yet.
          Setup continues in the background after you confirm.
        </p>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading zones…
          </p>
        ) : authExpired ? (
          <p className="text-sm text-muted-foreground">
            Reconnect to Cloudflare to list new domains from your account.
          </p>
        ) : error ? (
          <DesktopErrorBanner error={error} />
        ) : zones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No new zones to add. All Cloudflare zones are already in Relaybase.
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {zones.map((z) => (
              <FieldCheck
                key={z.id}
                id={`zone-${z.id}`}
                checked={Boolean(selected[z.name])}
                onCheckedChange={(on) =>
                  setSelected((prev) => ({ ...prev, [z.name]: on }))
                }
                label={`${z.name} · ${z.status}`}
              />
            ))}
          </div>
        )}
        {loading ? null : authExpired ? (
          <Button className="w-full" onClick={handleEnableEmailApi}>
            Enable email API
          </Button>
        ) : error ? (
          <Button className="w-full" onClick={() => void loadZones()}>
            Try again
          </Button>
        ) : zones.length > 0 ? (
          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={handleImport}
          >
            Add selected
            {selectedNames.length > 0 ? ` (${selectedNames.length})` : ""}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
