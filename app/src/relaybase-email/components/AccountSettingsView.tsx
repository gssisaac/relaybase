"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearEmailCache } from "@/relaybase-email/components/email-cached-fetch";
import { useEmailMailbox } from "@/relaybase-email/components/EmailMailboxContext";
import { EmailAlerts } from "@/relaybase-email/components/EmailShared";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDomain } from "@/lib/dashboard/DomainContext";

export function AccountSettingsView({ email }: { email: string }) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { activeDomain } = useDomain();
  const { addresses, refresh, setError, setMessage, error, message } =
    useEmailMailbox();
  const domainKey = activeDomain ?? "none";

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
    setMessage(null);
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
      setMessage("Display name saved");
      clearEmailCache(productId, `addresses:${domainKey}`);
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
          Account {email} was not found on the active domain.
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

      <EmailAlerts error={error} message={message} />

      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Address</Label>
          <Input value={email} readOnly className="h-10 bg-muted/30" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Display name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Support Team"
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Shown as the From name in recipient inboxes when you send from this
            address.
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving}
            onClick={() => void saveDisplayName()}
          >
            {saving ? "Saving…" : "Save display name"}
          </Button>
        </div>
      </div>
    </div>
  );
}
