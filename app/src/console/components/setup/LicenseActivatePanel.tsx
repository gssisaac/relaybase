"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  desktopSaveLicense,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useOptionalDesktop } from "@/lib/desktop/DesktopContext";

const LICENSE_API =
  process.env.NEXT_PUBLIC_LICENSE_API_URL ?? "https://console.relaybase.xyz";

export function LicenseActivatePanel() {
  const router = useRouter();
  const desktop = useOptionalDesktop();
  const credentials = desktop?.credentials ?? null;
  const refresh = desktop?.refresh;
  const [key, setKey] = useState(credentials?.licenseKey ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!desktop) return null;

  async function handleActivate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${LICENSE_API.replace(/\/$/, "")}/v1/license/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: key.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Invalid license");
      }
      await desktopSaveLicense(key.trim());
      setMessage("License activated and stored in ~/.relaybase.");
      await refresh?.();
      router.replace("/");
    } catch (err) {
      setError(explainDesktopError(err, "License activation failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">License</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste the key from your purchase receipt ($39 one-time).
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="license-key">License key</Label>
        <Input
          id="license-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="rb_lic_…"
          className="font-mono text-xs"
        />
      </div>
      <DesktopErrorBanner error={error} />
      {message ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={!key.trim() || busy}
        onClick={() => void handleActivate()}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Activate
      </Button>
    </div>
  );
}
