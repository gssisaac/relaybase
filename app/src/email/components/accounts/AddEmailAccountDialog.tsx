"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import { Label } from "@/components/ui/label";
import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import { sortAddressesByLocalPart } from "@/email/lib/accounts/enabled-accounts";
import { emailAccountHref } from "@/email/lib/paths";

type AddEmailAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function domainOf(email: string, domain?: string) {
  if (domain?.trim()) return domain.trim().toLowerCase();
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}

function localPartOf(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

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

  const accountGroups = useMemo(() => {
    const byDomain = new Map<string, typeof candidates>();
    for (const address of candidates) {
      const domain = domainOf(address.email, address.domain);
      if (!domain) continue;
      const list = byDomain.get(domain) ?? [];
      list.push(address);
      byDomain.set(domain, list);
    }
    return [...byDomain.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((domain) => ({
        heading: domain,
        options: (byDomain.get(domain) ?? []).map((address) => {
          const email = address.email;
          const local = localPartOf(email);
          return {
            value: email,
            label: email,
            keywords: [domain, local, email].join(" "),
          };
        }),
      }));
  }, [candidates]);

  const candidateEmails = useMemo(
    () => new Set(candidates.map((a) => a.email)),
    [candidates],
  );

  const selectedCandidateEmail =
    selectedEmail && candidateEmails.has(selectedEmail) ? selectedEmail : null;

  function handleOpenChange(next: boolean) {
    if (next) {
      void refreshAddresses();
      setSelectedEmail("");
    }
    onOpenChange(next);
  }

  function confirm() {
    if (!selectedCandidateEmail) return;
    addEnabledAccount(selectedCandidateEmail);
    setSelectedEmail("");
    onOpenChange(false);
    router.push(emailAccountHref("inbox", selectedCandidateEmail));
  }

  const hasAccounts = accountGroups.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
              <CmdDropdown
                triggerId="add-account-email"
                triggerClassName="min-w-0"
                value={selectedCandidateEmail}
                placeholder="Select account"
                searchPlaceholder="Search by email or domain…"
                groups={accountGroups}
                onValueChange={(value) => setSelectedEmail(value ?? "")}
              />
            </div>
          )}
          <Button
            className="w-full"
            disabled={!selectedCandidateEmail || loading}
            onClick={confirm}
          >
            Add account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
