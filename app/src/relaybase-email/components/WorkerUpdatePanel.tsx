"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { desktopUpdateWorker } from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/DesktopContext";

export function WorkerUpdatePanel() {
  const desktop = useOptionalDesktop();
  const credentials = desktop?.credentials ?? null;
  const refresh = desktop?.refresh;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!desktop || !credentials?.workerUrl) return null;

  async function handleUpdate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await desktopUpdateWorker();
      setMessage(`Worker updated at ${result.workerUrl}`);
      await refresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Routing Worker</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
            {credentials.workerUrl}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Script: {credentials.workerScriptName || "relaybase-api"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void handleUpdate()}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Update Worker
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
    </div>
  );
}
