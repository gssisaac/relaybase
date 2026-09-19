"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import { sortAddressesByLocalPart } from "@/email/lib/accounts/enabled-accounts";
import { emailAccountHref } from "@/email/lib/paths";

type AddEmailAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddEmailAccountDialog({
  open,
  onOpenChange,
}: AddEmailAccountDialogProps) {
  const router = useRouter();
  const {
    availableAddresses,
    enabledAccounts,
    addEnabledAccount,
    loading,
    error,
    refreshAddresses,
  } = useMailAccounts();
  const [selectedEmail, setSelectedEmail] = useState<string>("");

  const enabled = useMemo(
    () => new Set(enabledAccounts.map((e) => e.toLowerCase())),
    [enabledAccounts],
  );

  const candidates = useMemo(() => {
    return sortAddressesByLocalPart(
      availableAddresses.filter((a) => !enabled.has(a.email.toLowerCase())),
    );
  }, [availableAddresses, enabled]);

  const candidateEmails = useMemo(
    () => new Set(candidates.map((a) => a.email)),
    [candidates],
  );

  const selectedCandidateEmail =
    selectedEmail && candidateEmails.has(selectedEmail) ? selectedEmail : null;

  const hasAccounts = candidates.length > 0;

  async function confirm() {
    if (!selectedCandidateEmail) return;
    await addEnabledAccount(selectedCandidateEmail);
    onOpenChange(false);
    setSelectedEmail("");
    router.push(emailAccountHref("inbox", selectedCandidateEmail));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) void refreshAddresses();
        else setSelectedEmail("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add email account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose an address to add to the sidebar. Accounts are grouped by domain —
            search by email or domain. Create new senders under Dashboard → Accounts.
          </p>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading addresses…</p>
          ) : !hasAccounts ? (
            <p className="text-sm text-muted-foreground">
              No more addresses available. Add a sender under Dashboard → Accounts
              first.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="add-account-email">Account</Label>
              <AccountCmdDropdown
                triggerId="add-account-email"
                triggerClassName="min-w-0"
                addresses={candidates}
                autoRefresh={false}
                value={selectedCandidateEmail}
                onValueChange={(value) => setSelectedEmail(value ?? "")}
              />
            </div>
          )}
          <Button
            className="w-full"
            disabled={!selectedCandidateEmail || loading}
            onClick={() => void confirm()}
          >
            Add account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
