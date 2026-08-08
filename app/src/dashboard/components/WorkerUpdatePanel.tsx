"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  WORKER_INSTALL_ZIP_URL,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/DesktopContext";

export function WorkerUpdatePanel() {
  const desktop = useOptionalDesktop();
  const credentials = desktop?.credentials ?? null;

  if (!desktop || !credentials?.workerUrl) return null;

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
          <p className="mt-2 text-xs text-muted-foreground">
            Updates are deployed with Wrangler from the install ZIP — the app
            does not upload Worker code with a Cloudflare API token.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void desktopOpenExternal(WORKER_INSTALL_ZIP_URL)}
        >
          <Download className="size-3.5" />
          Install ZIP
        </Button>
      </div>
    </div>
  );
}
