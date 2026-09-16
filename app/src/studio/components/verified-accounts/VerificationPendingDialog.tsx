"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVerifiedAccounts } from "@/lib/studio/VerifiedAccountsContext";

export function VerificationPendingDialog({
  email,
  open,
  onOpenChange,
  onVerified,
}: {
  email: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: () => void;
}) {
  const store = useVerifiedAccounts();
  const trimmed = email?.trim().toLowerCase() ?? "";
  const busy =
    store.actionEmail === trimmed &&
    (store.actionPhase === "checking" || store.actionPhase === "requesting_cf");

  async function resend() {
    if (!trimmed) return;
    try {
      await store.requestCloudflareVerification(trimmed);
    } catch {
      // actionError surfaced on store
    }
  }

  async function checkNow() {
    if (!trimmed) return;
    const status = await store.checkVerificationNow(trimmed);
    if (status === "verified") {
      onVerified?.();
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verification pending</DialogTitle>
          <DialogDescription>
            Cloudflare sent a verification email to{" "}
            <span className="font-medium text-foreground">{trimmed}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-4 text-xs">
            <li>Open that inbox (Relaybase Mailbox if it is your domain address).</li>
            <li>Click <span className="font-medium">Verify email address</span>.</li>
            <li>Return here and choose Check status.</li>
          </ol>
          {store.actionError ? (
            <p className="text-xs text-destructive">{store.actionError}</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void resend()}>
            {busy ? "Sending…" : "Resend email"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => void checkNow()}>
              {busy ? "Checking…" : "Check status"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
