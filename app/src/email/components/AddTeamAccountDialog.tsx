"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import {
  desktopSaveTeamLogin,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { emailAccountHref } from "@/email/paths";

type AddTeamAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Worker URL from the existing team-login (team users already have one). */
  workerUrl: string;
};

/**
 * Team-user "Add account": signs in with account email + the per-account mobile
 * password, mirroring the Flutter companion's `add_account_screen`. Verifies
 * against `GET /mobile/config`, then replaces the active team account.
 */
export function AddTeamAccountDialog({
  open,
  onOpenChange,
  workerUrl,
}: AddTeamAccountDialogProps) {
  const router = useRouter();
  const { refresh } = useDesktop();
  const [accountEmail, setAccountEmail] = useState("");
  const [mobilePassword, setMobilePassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setAccountEmail("");
      setMobilePassword("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const url = workerUrl.trim().replace(/\/$/, "");
    const email = accountEmail.trim().toLowerCase();
    const password = mobilePassword;
    if (!email || !password) {
      setError({
        title: "All fields are required",
        detail: "Enter your account email and mobile password.",
        fix: "Ask your team admin for your mobile password (Accounts → Other device).",
      });
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`${url}/mobile/config`, {
        headers: {
          "X-Account-Email": email,
          Authorization: `Bearer ${password}`,
        },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        email?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Mobile login failed");
      }
      // dialog_only scope: replace the active team account (single account).
      await desktopSaveTeamLogin({
        workerUrl: url,
        accountEmail: email,
        mobilePassword: password,
      });
      await refresh();
      onOpenChange(false);
      router.push(emailAccountHref("inbox", email));
    } catch (err) {
      setError(explainDesktopError(err, "Add account failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <p className="text-sm text-muted-foreground">
            Sign in with your account email and the mobile password your admin
            set up in Accounts → Other device.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="team-account-email">Account email</Label>
            <Input
              id="team-account-email"
              type="email"
              autoComplete="email"
              required
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="you@yourdomain.com"
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-mobile-password">Mobile password</Label>
            <Input
              id="team-mobile-password"
              type="password"
              autoComplete="current-password"
              required
              value={mobilePassword}
              onChange={(e) => setMobilePassword(e.target.value)}
              disabled={busy}
            />
          </div>
          <DesktopErrorBanner error={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Add account
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
