"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  desktopRegisterWorkerWithConsole,
  desktopSaveWorkerConnection,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { SetupCenteredPage } from "@/console/components/setup/setup-page-chrome";

export default function SetupConnectPage() {
  const router = useRouter();
  const { refresh } = useDesktop();
  const [workerUrl, setWorkerUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await desktopVerifyWorkerConnection(
        workerUrl.trim(),
        adminToken.trim(),
      );
      await desktopSaveWorkerConnection({
        workerUrl: result.workerUrl,
        adminToken: adminToken.trim(),
        workerScriptName: result.workerScriptName,
      });
      void desktopRegisterWorkerWithConsole(result.workerUrl).catch(() => {
        /* best-effort */
      });
      await refresh();
      router.replace("/");
    } catch (err) {
      setError(explainDesktopError(err, "Could not verify Worker"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupCenteredPage>
      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Connect existing Worker
          </h1>
          <p className="text-xs text-muted-foreground">
            Already installed Relaybase on Cloudflare? Paste your Worker URL
            and admin token to continue on this Mac.
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void handleVerify(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="worker-url">Worker URL</Label>
            <Input
              id="worker-url"
              autoFocus
              value={workerUrl}
              onChange={(e) => setWorkerUrl(e.target.value)}
              placeholder="https://relaybase-api.<subdomain>.workers.dev"
              className="font-mono text-xs"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-token">Admin token</Label>
            <Input
              id="admin-token"
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="rb_admin_…"
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <button
              type="button"
              className="text-left text-xs text-muted-foreground hover:underline"
              onClick={() => router.push("/setup/recover-admin")}
            >
              I forgot my admin token
            </button>
          </div>
          <DesktopErrorBanner error={error} />
          <Button
            type="submit"
            className="w-full"
            disabled={busy || !workerUrl.trim() || !adminToken.trim()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Verify &amp; continue
          </Button>
        </form>
      </div>
    </SetupCenteredPage>
  );
}
