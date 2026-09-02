"use client";

import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOptionalAppUpdater } from "@/lib/desktop/updater/AppUpdaterContext";

export function AppUpdateBanner() {
  const updater = useOptionalAppUpdater();
  if (!updater) return null;

  const { phase, version, progressLabel, restartToUpdate } = updater;
  if (phase === "idle" || phase === "checking") return null;

  if (phase === "ready" && version) {
    return (
      <div className="shrink-0 px-2 pb-2">
        <Card size="sm" className="gap-2 py-2.5 shadow-none">
          <CardContent className="px-2.5">
            <Button
              type="button"
              size="sm"
              className="h-7 w-full text-[11px]"
              onClick={() => void restartToUpdate()}
            >
              <RefreshCw className="size-3" />
              Restart to update (v{version})
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusText =
    progressLabel ?? (version ? `Downloading v${version}…` : "Downloading update…");

  return (
    <div className="shrink-0 px-2 pb-2" role="status" aria-live="polite">
      <Card size="sm" className="gap-2 py-2.5 shadow-none">
        <CardContent className="flex items-start gap-2 px-2.5">
          <Download className="mt-0.5 size-3 shrink-0 opacity-80" aria-hidden />
          <p className="min-w-0 text-[11px] leading-snug text-foreground">
            {statusText}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
