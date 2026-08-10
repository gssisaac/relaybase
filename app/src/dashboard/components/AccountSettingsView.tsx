"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clearEmailCache } from "@/email/components/email-cached-fetch";
import { EmailAlerts } from "@/email/components/EmailShared";
import { useEmailPaths } from "@/email/paths";
import { useAccounts } from "@/lib/dashboard/AccountsContext";
import { notifyAddressesChanged } from "@/lib/dashboard/accounts-sync";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api-base";

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "none";
}

export function AccountSettingsView({ email }: { email: string }) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const accountsStore = useAccounts();
  const domainKey = domainOf(email);
  const emailKey = email.trim().toLowerCase();

  const address = accountsStore
    .addressesFor(domainKey)
    .find((entry) => entry.email.toLowerCase() === emailKey);

  const inboundEnabled = address?.inboundEnabled !== false;
  const inboundPending = accountsStore.isInboundPending(emailKey);

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void accountsStore.refresh(domainKey);
  }, [accountsStore, domainKey]);

  useEffect(() => {
    setDisplayName(address?.displayName ?? "");
  }, [address?.displayName, address?.email]);

  async function saveDisplayName() {
    setSaving(true);
    setError(null);
    try {
      const res = await desktopAwareFetch(`${apiBase}/addresses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailKey,
          displayName,
        }),
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.success("Display name saved");
      clearEmailCache(productId, `addresses:${domainKey}`);
      clearEmailCache(productId, "addresses:all");
      notifyAddressesChanged({ domain: domainKey, emails: [emailKey] });
      await accountsStore.refresh(domainKey, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const loading =
    !accountsStore.hasHydrated(domainKey) &&
    accountsStore.loadingDomain === domainKey;

  if (!loading && accountsStore.hasHydrated(domainKey) && !address) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          Account {emailKey} was not found.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground">
          Identity settings for {emailKey}
        </p>
      </div>

      <EmailAlerts error={error} message={null} />

      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="account-email">Email</Label>
          <Input id="account-email" value={emailKey} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-display-name">Display name</Label>
          <Input
            id="account-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Optional"
            disabled={!address}
          />
        </div>
        <Button
          size="sm"
          onClick={() => void saveDisplayName()}
          disabled={saving || !address}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="account-accept-inbound" className="text-sm font-medium">
              Accept inbound mail
            </Label>
            <p className="text-xs text-muted-foreground">
              {inboundEnabled
                ? "Messages are delivered to the Relaybase inbox."
                : "Replies are dropped at Cloudflare (no bounce)."}
            </p>
          </div>
          <Switch
            id="account-accept-inbound"
            checked={inboundEnabled}
            disabled={inboundPending || !address}
            onCheckedChange={(on) =>
              void accountsStore.setInboundEnabled(domainKey, emailKey, on)
            }
          />
        </div>
      </div>
    </div>
  );
}
