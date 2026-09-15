"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [selectedDomain, setSelectedDomain] = useState<string>("");
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

  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const address of candidates) {
      const domain = domainOf(address.email, address.domain);
      if (domain) set.add(domain);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const accountsForDomain = useMemo(() => {
    if (!selectedDomain) return [];
    return candidates.filter(
      (address) => domainOf(address.email, address.domain) === selectedDomain,
    );
  }, [candidates, selectedDomain]);

  const domainOptions = useMemo(
    () => domains.map((domain) => ({ value: domain, label: domain })),
    [domains],
  );

  const accountOptions = useMemo(
    () =>
      accountsForDomain.map((address) => ({
        value: address.email,
        label: address.email,
      })),
    [accountsForDomain],
  );

  useEffect(() => {
    if (!selectedDomain) return;
    if (!domains.includes(selectedDomain)) {
      setSelectedDomain("");
      setSelectedEmail("");
    }
  }, [domains, selectedDomain]);

  useEffect(() => {
    if (!selectedEmail) return;
    if (!accountsForDomain.some((a) => a.email === selectedEmail)) {
      setSelectedEmail("");
    }
  }, [accountsForDomain, selectedEmail]);

  function handleOpenChange(next: boolean) {
    if (next) {
      void refreshAddresses();
      setSelectedDomain("");
      setSelectedEmail("");
    }
    onOpenChange(next);
  }

  function confirm() {
    if (!selectedEmail) return;
    addEnabledAccount(selectedEmail);
    setSelectedDomain("");
    setSelectedEmail("");
    onOpenChange(false);
    router.push(emailAccountHref("inbox", selectedEmail));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick a domain, then choose an existing address. Create new senders
            under Dashboard → Accounts.
          </p>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading addresses…</p>
          ) : domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No more addresses available. Add a sender under Dashboard →
              Accounts first.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="add-account-domain">Domain</Label>
                <CmdDropdown
                  triggerId="add-account-domain"
                  triggerClassName="min-w-0"
                  value={selectedDomain || null}
                  placeholder="Select domain"
                  searchPlaceholder="Search domains…"
                  options={domainOptions}
                  onValueChange={(value) => {
                    setSelectedDomain(value ?? "");
                    setSelectedEmail("");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-account-email">Account</Label>
                <CmdDropdown
                  triggerId="add-account-email"
                  triggerClassName="min-w-0"
                  value={selectedEmail || null}
                  placeholder={
                    selectedDomain ? "Select account" : "Select a domain first"
                  }
                  searchPlaceholder="Search accounts…"
                  options={accountOptions}
                  disabled={!selectedDomain}
                  onValueChange={(value) => setSelectedEmail(value ?? "")}
                />
              </div>
            </>
          )}
          <Button
            className="w-full"
            disabled={!selectedEmail || loading}
            onClick={confirm}
          >
            Add account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
