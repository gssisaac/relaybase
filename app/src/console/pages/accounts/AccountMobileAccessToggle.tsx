"use client";

// Parked for post-launch mobile companion — do not import until mobile ships.

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAccounts } from "@/lib/dashboard/AccountsContext";
import { toast } from "sonner";

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/**
 * Allow / hide this address for the Flutter mobile companion via
 * `mobileEnabled` on the catalog row.
 */
export function AccountMobileAccessToggle({ email }: { email: string }) {
  const accountsStore = useAccounts();
  const emailKey = email.trim().toLowerCase();
  const domainKey = domainOf(emailKey);

  const address = accountsStore
    .addressesFor(domainKey)
    .find((entry) => entry.email.toLowerCase() === emailKey);
  const mobileEnabled = address?.mobileEnabled !== false;
  const pending = accountsStore.isMobilePending(emailKey);

  async function toggleMobile(next: boolean) {
    try {
      await accountsStore.setMobileEnabled(domainKey, emailKey, next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  }

  return (
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
  );
}
