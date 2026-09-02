"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  isEmailApiNotConfiguredError,
  useOpenEnableEmailApiDialog,
} from "@/console/components/setup/use-enable-email-api-dialog";
import { useDomain } from "@/lib/dashboard/DomainContext";
import {
  isZoneListNeedsWorkerUpdate,
  listCloudflareZones,
  loadWorkerVersionCompare,
} from "@/lib/dashboard/list-cf-zones";
import {
  connectedCfAccountId,
  explainDesktopError,
  type DesktopErrorHelp,
  type ZoneSummary,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner, useOptionalDesktop } from "@/lib/desktop/shell";
import { Button } from "@/components/ui/button";
import { FieldCheck } from "@/components/ui/field-check";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function needsEnableEmailApi(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return isEmailApiNotConfiguredError(message);
}

/**
 * List zones from the Worker (`CF_API_TOKEN`) and queue selected ones
 * for background onboarding.
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
  const router = useRouter();
  const desktop = useOptionalDesktop();
  const openEnableEmailApiDialog = useOpenEnableEmailApiDialog();
  const connectedAccountId = connectedCfAccountId(desktop?.credentials);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [emailApiMissing, setEmailApiMissing] = useState(false);
  const [needsWorkerUpdate, setNeedsWorkerUpdate] = useState(false);

  const loadZones = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmailApiMissing(false);
    setNeedsWorkerUpdate(false);
    try {
      const list = await listCloudflareZones(connectedAccountId);
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
      const missing = needsEnableEmailApi(err);
      const stale = isZoneListNeedsWorkerUpdate(err);
      setEmailApiMissing(missing);
      setNeedsWorkerUpdate(stale);
      const help = explainDesktopError(err, "Failed to list zones");
      if (stale) {
        const versions = await loadWorkerVersionCompare(
          desktop?.credentials?.workerUrl,
        );
        if (versions) help.versions = versions;
      }
      setError(help);
      setZones([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }, [store.domains, desktop?.credentials?.workerUrl, connectedAccountId]);

  useEffect(() => {
    if (!open) return;
    void loadZones();
  }, [open, loadZones]);

  const selectedNames = Object.entries(selected)
    .filter(([, on]) => on)
    .map(([name]) => name);
  const canSubmit = !loading && selectedNames.length > 0;

  function handleImport() {
    if (selectedNames.length === 0) return;
    store.queueAddDomains(selectedNames);
    setOpen(false);
    setError(null);
    setEmailApiMissing(false);
    setNeedsWorkerUpdate(false);
  }

  function handleEnableEmailApi() {
    openEnableEmailApiDialog({
      onVerified: () => {
        void loadZones();
      },
    });
  }

  function handleOpenWorkerUpdate() {
    setOpen(false);
    router.push("/settings/worker/update");
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
          New domains on the connected Cloudflare account that are not in
          Relaybase yet. Setup continues in the background after you confirm.
        </p>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading zones…
          </p>
        ) : emailApiMissing ? (
          <p className="text-sm text-muted-foreground">
            Add a CF_API_TOKEN on the Worker to list new domains from your
            account.
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
        {loading ? null : emailApiMissing ? (
          <Button className="w-full" onClick={handleEnableEmailApi}>
            Enable email API
          </Button>
        ) : needsWorkerUpdate ? (
          <Button className="w-full" onClick={handleOpenWorkerUpdate}>
            Check for Worker update
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
