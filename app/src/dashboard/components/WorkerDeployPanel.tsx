"use client";

import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Rocket, RefreshCw, Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  desktopGetBundledWorkerVersion,
  desktopGetDeployedWorkerVersion,
  desktopGetDesktopSettings,
  desktopSaveDesktopSettings,
  explainDesktopError,
  isDesktopRuntime,
  type DesktopErrorHelp,
  type DesktopSettings,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { getWorkerDeployStore } from "@/lib/desktop/deploy-store";
import { cn } from "@/lib/utils";

/** Compare dotted version strings. Returns -1, 0, or 1. Empty < anything. */
function compareVersions(a: string, b: string): number {
  const pa = a.trim().split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.trim().split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

type DeployPanelProps = {
  /** Current stored worker URL + admin token (from credentials). */
  workerUrl: string;
  adminToken: string;
  /** Called after a successful deploy so Settings can refresh status/creds. */
  onDeployed: () => void | Promise<void>;
};

export const WorkerDeployPanel = observer(function WorkerDeployPanel({
  workerUrl,
  adminToken,
  onDeployed,
}: DeployPanelProps) {
  const store = useMemo(() => getWorkerDeployStore(), []);
  const [open, setOpen] = useState(false);
  const [enableD1, setEnableD1] = useState(false);
  const [autoRedeploy, setAutoRedeploy] = useState(true);
  const [bundledVersion, setBundledVersion] = useState<string | null>(null);
  const [deployedVersion, setDeployedVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<DesktopErrorHelp | null>(
    null,
  );

  const hasWorker = Boolean(workerUrl.trim() && adminToken.trim());

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let cancelled = false;
    desktopGetDesktopSettings()
      .then((s: DesktopSettings) => {
        if (cancelled) return;
        setAutoRedeploy(s.autoRedeployOnUpdate);
        setEnableD1(s.enableD1Logs);
      })
      .catch(() => {
        /* defaults are fine */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function persistSettings(patch: Partial<DesktopSettings>) {
    if (!isDesktopRuntime()) return;
    void desktopGetDesktopSettings()
      .then((current) => {
        const next: DesktopSettings = { ...current, ...patch };
        return desktopSaveDesktopSettings(next);
      })
      .catch(() => {
        /* best-effort */
      });
  }

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let cancelled = false;
    desktopGetBundledWorkerVersion()
      .then((v) => {
        if (!cancelled) setBundledVersion(v);
      })
      .catch(() => {
        /* bundled ZIP not yet built — leave null */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDeployedVersion(null);
    setVersionError(null);
    if (!hasWorker) return;
    let cancelled = false;
    desktopGetDeployedWorkerVersion(workerUrl.trim(), adminToken.trim())
      .then((info) => {
        if (!cancelled) setDeployedVersion(info.workerVersion || null);
      })
      .catch((err) => {
        if (!cancelled)
          setVersionError(
            explainDesktopError(err, "Could not read deployed Worker version"),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [workerUrl, adminToken, hasWorker, store.result]);

  const updateAvailable =
    bundledVersion != null &&
    deployedVersion != null &&
    compareVersions(bundledVersion, deployedVersion) > 0;

  async function handleDeploy() {
    setVersionError(null);
    try {
      await store.deploy({ enableD1Logs: enableD1, rotateAdminToken: false });
      setOpen(false);
      await onDeployed();
    } catch {
      /* error surfaced in the log panel + store.error */
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium">In-app deploy</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Run Wrangler inside the app and stream the logs — no manual ZIP
            download or terminal needed.
          </p>
        </div>
        {updateAvailable ? (
          <Badge variant="destructive" className="gap-1">
            <RefreshCw className="size-3" />
            Worker update available
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <VersionRow label="Bundled" value={bundledVersion} />
        <VersionRow label="Deployed" value={deployedVersion} />
      </div>

      <DesktopErrorBanner error={versionError} />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={store.busy}
          onClick={() => setOpen(true)}
        >
          <Rocket className="size-3.5" />
          {hasWorker ? "Redeploy & run migrations" : "Deploy Worker"}
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={enableD1}
            onCheckedChange={(v) => {
              const next = v === true;
              setEnableD1(next);
              persistSettings({ enableD1Logs: next });
            }}
          />
          Enable dashboard Logs (creates a D1 database + runs migrations)
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="text-xs font-medium">Auto-redeploy on app update</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            When the app updates and bundles a newer Worker, redeploy it and run
            migrations automatically on launch.
          </p>
        </div>
        <Switch
          checked={autoRedeploy}
          onCheckedChange={(v) => {
            const next = v === true;
            setAutoRedeploy(next);
            persistSettings({ autoRedeployOnUpdate: next });
          }}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="size-4" />
              {hasWorker ? "Redeploy Worker" : "Deploy Worker"}
            </DialogTitle>
            <DialogDescription>
              Streams <span className="font-mono">wrangler deploy</span> /
              migrations live. Keep this window open until it finishes.
            </DialogDescription>
          </DialogHeader>

          <DeployLogPanel store={store} />

          <DesktopErrorBanner error={store.error ? { title: "Deploy failed", detail: store.error, fix: "Check the log panel above for the failing step, then retry." } : null} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={store.busy}
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={store.busy}
              onClick={() => void handleDeploy()}
            >
              {store.busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Rocket className="size-3.5" />
              )}
              {store.busy ? "Deploying…" : "Start deploy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

function VersionRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label} worker</p>
      <p className="mt-0.5 font-mono">{value ?? "—"}</p>
    </div>
  );
}

const DeployLogPanel = observer(function DeployLogPanel({ store }: {
  store: ReturnType<typeof getWorkerDeployStore>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = store.lines;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium capitalize">
          {store.phase === "idle" ? "Ready" : store.phase}
        </span>
        <span className="text-muted-foreground">{store.statusMessage}</span>
      </div>
      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto rounded-lg bg-black/90 p-3 font-mono text-[11px] leading-relaxed text-zinc-200 ring-1 ring-foreground/10"
      >
        {lines.length === 0 ? (
          <p className="text-zinc-500">
            Press “Start deploy” to begin. Logs from wrangler will stream here.
          </p>
        ) : (
          lines.map((l, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap break-all",
                l.stream === "stderr" && "text-amber-300",
              )}
            >
              <span className="mr-2 select-none text-zinc-500">
                {l.step}
              </span>
              {l.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
});
