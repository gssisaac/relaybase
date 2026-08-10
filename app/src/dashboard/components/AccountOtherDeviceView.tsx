"use client";

import { Info, QrCode as QrCodeIcon, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { QrCode } from "@/components/ui/qr-code";
import { useAccounts } from "@/lib/dashboard/AccountsContext";
import { resolveEmailApiBase } from "@/lib/desktop/api-base";
import {
  buildConnectDeepLink,
  fetchMobileConfigStatus,
  type MobileConfigStatus,
} from "@/lib/desktop/mobile-config";

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/**
 * Other device tab in the account detail sheet. Lets the desktop user enable
 * or disable mobile access for a single address and shows a pairing QR the
 * Flutter app scans to auto-fill the Worker URL + mobile password.
 */
export function AccountOtherDeviceView({ email }: { email: string }) {
  const accountsStore = useAccounts();
  const emailKey = email.trim().toLowerCase();
  const domainKey = domainOf(emailKey);

  const address = accountsStore
    .addressesFor(domainKey)
    .find((entry) => entry.email.toLowerCase() === emailKey);
  const mobileEnabled = address?.mobileEnabled !== false;
  const pending = accountsStore.isMobilePending(emailKey);

  const [globalStatus, setGlobalStatus] = useState<MobileConfigStatus | null>(
    null,
  );
  const [statusLoading, setStatusLoading] = useState(true);
  const [password, setPassword] = useState("");

  const workerUrl = resolveEmailApiBase();

  useEffect(() => {
    if (!domainKey) return;
    void accountsStore.refresh(domainKey);
  }, [accountsStore, domainKey]);

  useEffect(() => {
    let cancelled = false;
    setStatusLoading(true);
    fetchMobileConfigStatus()
      .then((s) => {
        if (!cancelled) setGlobalStatus(s);
      })
      .catch(() => {
        if (!cancelled) setGlobalStatus({ enabled: false, updatedAt: null });
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleMobile(next: boolean) {
    try {
      await accountsStore.setMobileEnabled(domainKey, emailKey, next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  }

  const globalEnabled = globalStatus?.enabled ?? false;
  const showQr =
    globalEnabled && mobileEnabled && Boolean(workerUrl) && password.trim().length > 0;
  const deepLink = showQr
    ? buildConnectDeepLink({
        workerUrl: workerUrl,
        password: password.trim(),
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold">Other device</h2>
        <p className="text-xs text-muted-foreground">
          Pair the Relaybase mobile app with this account.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label className="text-sm font-medium">
            Allow mobile access for this account
          </Label>
          <p className="text-xs text-muted-foreground">
            {mobileEnabled
              ? "This account is visible to the mobile app."
              : "This account is hidden from the mobile app."}
          </p>
        </div>
        <Switch
          checked={mobileEnabled}
          disabled={pending || !address}
          onCheckedChange={(next) => void toggleMobile(next)}
        />
      </div>

      {!globalEnabled && !statusLoading ? (
        <Alert>
          <Info className="size-4" aria-hidden />
          <AlertTitle>Mobile access is not enabled</AlertTitle>
          <AlertDescription>
            Enable mobile access in Settings first to generate a password and
            pair this account.
          </AlertDescription>
        </Alert>
      ) : null}

      {globalEnabled && mobileEnabled ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Pair a device</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Copy the mobile password from Settings, paste it here, then scan
            the QR with the Relaybase mobile app. The QR encodes the Worker URL
            and password — keep it private.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="mobile-pair-password">Mobile password</Label>
            <Input
              id="mobile-pair-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Paste the mobile password from Settings"
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {showQr && deepLink ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-border/60 bg-white p-3">
              <QrCode value={deepLink} size={192} />
              <p className="text-[11px] text-muted-foreground">
                Scan with the Relaybase mobile app
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              <QrCodeIcon className="size-4" aria-hidden />
              Enter the mobile password to show the pairing QR.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
