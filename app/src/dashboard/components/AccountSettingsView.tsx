"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldCheck } from "@/components/ui/field-check";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearEmailCache } from "@/email/components/email-cached-fetch";
import { useEmailMailbox } from "@/email/components/EmailMailboxContext";
import { EmailAlerts } from "@/email/components/EmailShared";
import { useEmailPaths } from "@/email/paths";
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
  const { addresses, refresh, setError, error } = useEmailMailbox();
  const domainKey = domainOf(email);

  const address = addresses.find(
    (entry) => entry.email.toLowerCase() === email.toLowerCase(),
  );
  const [displayName, setDisplayName] = useState("");
  const [inboundEnabled, setInboundEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingInbound, setSavingInbound] = useState(false);

  useEffect(() => {
    setDisplayName(address?.displayName ?? "");
    setInboundEnabled(address?.inboundEnabled !== false);
  }, [address?.displayName, address?.email, address?.inboundEnabled]);

  async function saveDisplayName() {
    setSaving(true);
    setError(null);
    try {
      const res = await desktopAwareFetch(`${apiBase}/addresses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          displayName,
        }),
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.success("Display name saved");
      clearEmailCache(productId, `addresses:${domainKey}`);
      clearEmailCache(productId, "addresses:all");
      notifyAddressesChanged({ domain: domainKey, emails: [email] });
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveInboundEnabled(next: boolean) {
    const previous = inboundEnabled;
    setInboundEnabled(next);
    setSavingInbound(true);
    setError(null);
    try {
      const res = await desktopAwareFetch(`${apiBase}/addresses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          inboundEnabled: next,
        }),
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to update inbound");
      toast.success(
        next ? "Inbound mail enabled" : "Inbound mail blocked (dropped)",
      );
      clearEmailCache(productId, `addresses:${domainKey}`);
      clearEmailCache(productId, "addresses:all");
      notifyAddressesChanged({ domain: domainKey, emails: [email] });
      await refresh(true);
    } catch (e) {
      setInboundEnabled(previous);
      setError(e instanceof Error ? e.message : "Failed to update inbound");
    } finally {
      setSavingInbound(false);
    }
  }

  if (!address && addresses.length > 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          Account {email} was not found.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground">
          Identity settings for {email}
        </p>
      </div>

      <EmailAlerts error={error} message={null} />

      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="account-email">Email</Label>
          <Input id="account-email" value={email} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-display-name">Display name</Label>
          <Input
            id="account-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <Button size="sm" onClick={() => void saveDisplayName()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-medium">Inbound mail</h3>
          <p className="text-xs text-muted-foreground">
            When off, Cloudflare Email Routing drops messages to this address
            without storing them.
          </p>
        </div>
        <FieldCheck
          id="account-accept-inbound"
          checked={inboundEnabled}
          disabled={savingInbound || !address}
          onCheckedChange={(on) => void saveInboundEnabled(on)}
          label="Accept inbound mail"
          description={
            inboundEnabled
              ? "Messages are delivered to the Relaybase inbox."
              : "Replies are dropped at Cloudflare (no bounce)."
          }
        />
      </div>
    </div>
  );
}
