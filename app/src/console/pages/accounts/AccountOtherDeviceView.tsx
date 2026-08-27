"use client";

import {
  Check,
  Copy,
  Info,
  QrCode as QrCodeIcon,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { QrCode } from "@/components/ui/qr-code";
import { useAccounts } from "@/lib/dashboard/AccountsContext";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import {
  buildConnectDeepLink,
  clearAccountMobilePassword,
  fetchAccountMobileStatus,
  setAccountMobilePassword,
  type AccountMobileStatus,
} from "@/lib/desktop/mobile";

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/**
 * Other device tab in the account detail sheet. Lets the desktop user enable
 * or disable mobile access for a single address, generate a per-account
 * mobile password, and show a pairing QR the Flutter app scans to auto-fill
 * the Worker URL + account email + password.
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

  const [status, setStatus] = useState<AccountMobileStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [plainPassword, setPlainPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const workerUrl = resolveEmailApiBase();

  useEffect(() => {
    if (!domainKey) return;
    void accountsStore.refresh(domainKey);
  }, [accountsStore, domainKey]);

  useEffect(() => {
    let cancelled = false;
    setStatusLoading(true);
    fetchAccountMobileStatus(emailKey)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus({ hasPassword: false, updatedAt: null });
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [emailKey]);

  async function toggleMobile(next: boolean) {
    try {
      await accountsStore.setMobileEnabled(domainKey, emailKey, next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const result = await setAccountMobilePassword(emailKey);
      setStatus({ hasPassword: true, updatedAt: result.updatedAt });
      setPlainPassword(result.password);
      toast.success("Mobile password generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set password");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    try {
      const s = await clearAccountMobilePassword(emailKey);
      setStatus(s);
      setPlainPassword(null);
      toast.success("Mobile password cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear password");
    } finally {
      setBusy(false);
    }
  }

  async function copyPassword() {
    if (!plainPassword) return;
    try {
      await navigator.clipboard.writeText(plainPassword);
      setCopied(true);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  }

  const hasPassword = status?.hasPassword ?? false;
  const showQr =
    mobileEnabled &&
    hasPassword &&
    Boolean(workerUrl) &&
    plainPassword &&
    plainPassword.trim().length > 0;
  const deepLink = showQr
    ? buildConnectDeepLink({
        workerUrl: workerUrl,
        email: emailKey,
        password: plainPassword!.trim(),
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

      {mobileEnabled ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Pair a device</p>
          </div>

          {!statusLoading && !hasPassword ? (
            <Alert>
              <Info className="size-4" aria-hidden />
              <AlertTitle>No mobile password set</AlertTitle>
              <AlertDescription>
                Generate a password for this account to let the mobile app
                sign in with this email address.
              </AlertDescription>
            </Alert>
          ) : null}

          <p className="text-xs text-muted-foreground">
            {hasPassword
              ? "A mobile password is set for this account. Regenerate to issue a new one — old mobile sessions stop working immediately."
              : "Generate a per-account password the mobile app uses to sign in with this email. It is shown once and stored only in Worker KV."}
          </p>

          {plainPassword ? (
            <div className="space-y-1.5">
              <Label htmlFor="mobile-pair-password">Mobile password</Label>
              <div className="flex gap-2">
                <Input
                  id="mobile-pair-password"
                  type="text"
                  value={plainPassword}
                  readOnly
                  className="font-mono text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyPassword()}
                  aria-label="Copy password"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Copy this password and scan the QR with the Relaybase mobile
                app. It won&apos;t be shown again.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleGenerate()}
            >
              <RefreshCw className="size-3.5" />
              {hasPassword ? "Regenerate password" : "Generate password"}
            </Button>
            {hasPassword ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void handleClear()}
              >
                Clear password
              </Button>
            ) : null}
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
              {hasPassword
                ? "Generating password to show the pairing QR…"
                : "Generate a password to show the pairing QR."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
