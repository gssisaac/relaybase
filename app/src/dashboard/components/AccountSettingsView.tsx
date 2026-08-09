"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearEmailCache } from "@/email/components/email-cached-fetch";
import { useEmailMailbox } from "@/email/components/EmailMailboxContext";
import { EmailAlerts } from "@/email/components/EmailShared";
import { useEmailPaths } from "@/email/paths";
import { notifyAddressesChanged } from "@/lib/dashboard/accounts-sync";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(address?.displayName ?? "");
  }, [address?.displayName, address?.email]);

  async function saveDisplayName() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/addresses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          displayName,
        }),
      });
      const data = await res.json();
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
    </div>
  );
}
