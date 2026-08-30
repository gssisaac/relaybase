"use client";

/**
 * Teammate login tab — issue a per-account password so a teammate can access
 * this mailbox (desktop invited login). Mobile companion UI is parked in
 * AccountMobileAccessToggle.tsx and AccountMobilePairingQr.tsx (do not import
 * until mobile ships).
 */

import { Check, Copy, Info, RefreshCw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearAccountMobilePassword,
  fetchAccountMobileStatus,
  setAccountMobilePassword,
  type AccountMobileStatus,
} from "@/lib/desktop/mobile";

type ConfirmAction = "regenerate" | "clear" | null;

export function AccountTeammateLoginView({ email }: { email: string }) {
  const emailKey = email.trim().toLowerCase();

  const [status, setStatus] = useState<AccountMobileStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [plainPassword, setPlainPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

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

  const hasPassword = status?.hasPassword ?? false;

  async function handleGenerate() {
    const regenerating = hasPassword;
    setBusy(true);
    setConfirmAction(null);
    try {
      const result = await setAccountMobilePassword(emailKey);
      setStatus({ hasPassword: true, updatedAt: result.updatedAt });
      setPlainPassword(result.password);
      toast.success(
        regenerating ? "Password regenerated" : "Password generated",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set password");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    setConfirmAction(null);
    try {
      const s = await clearAccountMobilePassword(emailKey);
      setStatus(s);
      setPlainPassword(null);
      toast.success("Password cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear password");
    } finally {
      setBusy(false);
    }
  }

  function requestGenerate() {
    if (hasPassword) {
      setConfirmAction("regenerate");
      return;
    }
    void handleGenerate();
  }

  function requestClear() {
    setConfirmAction("clear");
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

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold">Teammate login</h2>
        <p className="text-xs text-muted-foreground">
          Give a teammate access to this account&apos;s mailbox. They sign in
          with this email and the password below — inbox only, no dashboard.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Account password</p>
        </div>

        {!statusLoading && !hasPassword ? (
          <Alert>
            <Info className="size-4" aria-hidden />
            <AlertTitle>No password set</AlertTitle>
            <AlertDescription>
              Generate a password for this account so a teammate can sign in
              with this email address.
            </AlertDescription>
          </Alert>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {hasPassword
            ? "A password is set for this account. Regenerate to issue a new one — old teammate sessions stop working immediately."
            : "Generate a per-account password a teammate uses to sign in with this email. It is shown once — copy it and share it securely."}
        </p>

        {plainPassword ? (
          <div className="space-y-1.5">
            <Label htmlFor="teammate-password">Teammate password</Label>
            <div className="flex gap-2">
              <Input
                id="teammate-password"
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
              Copy this password and share it with your teammate. It won&apos;t
              be shown again.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={requestGenerate}
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
              onClick={requestClear}
            >
              Clear password
            </Button>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "clear"
                ? "Clear teammate password?"
                : "Regenerate teammate password?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "clear"
                ? "Teammates signed in with this password will lose access immediately."
                : "The current password stops working immediately. Teammates will need the new password."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction === "clear") void handleClear();
                else void handleGenerate();
              }}
            >
              {confirmAction === "clear" ? "Clear password" : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
