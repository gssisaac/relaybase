"use client";

import { useState, useMemo, useEffect } from "react";
import { AtSign, Check, Loader2, Mail, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAccounts } from "@/lib/dashboard/AccountsContext";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { suggestedDisplayNameForLocalPart } from "@/lib/dashboard/default-addresses";
import { getHqUser } from "@/lib/hq-auth/session";

const POPULAR_LOCAL_PARTS = ["team", "hello", "support", "contact", "billing"];

export function Step3AccountCard({
  defaultDomain,
  onComplete,
  onBack,
}: {
  defaultDomain: string;
  onComplete: (createdEmail: string) => void;
  onBack?: () => void;
}) {
  const accountsStore = useAccounts();
  const domainStore = useDomain();
  const user = getHqUser();

  const readyDomains = useMemo(
    () => domainStore.domains.filter((d) => !d.onboarding || d.onboarding.status === "ready"),
    [domainStore.domains],
  );

  const [selectedDomain, setSelectedDomain] = useState(
    defaultDomain || readyDomains[0]?.domain || "",
  );

  const [localPart, setLocalPart] = useState("team");
  const [displayName, setDisplayName] = useState("Team");
  const [inboundEnabled, setInboundEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDomain && readyDomains.length > 0) {
      setSelectedDomain(readyDomains[0]!.domain);
    }
  }, [readyDomains, selectedDomain]);

  // Preset chips including username
  const presets = useMemo(() => {
    const list = [...POPULAR_LOCAL_PARTS];
    if (user?.username && !list.includes(user.username.toLowerCase())) {
      list.unshift(user.username.toLowerCase());
    }
    return list;
  }, [user?.username]);

  function handleSelectPreset(preset: string) {
    setLocalPart(preset);
    setDisplayName(suggestedDisplayNameForLocalPart(preset) || preset);
    setError(null);
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    const cleanLocalPart = localPart.trim().toLowerCase();
    const cleanDomain = selectedDomain.trim().toLowerCase();

    if (!cleanDomain) {
      setError("Please select a domain.");
      return;
    }
    if (!cleanLocalPart) {
      setError("Please enter a mailbox name (e.g. team or hello).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await accountsStore.create(cleanDomain, {
        localPart: cleanLocalPart,
        displayName: displayName.trim() || suggestedDisplayNameForLocalPart(cleanLocalPart),
        inboundEnabled,
      });

      const fullEmail = `${cleanLocalPart}@${cleanDomain}`;
      toast.success(`Account ${fullEmail} created successfully!`);
      onComplete(fullEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account address.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">
          Step 3: Create Initial Mail Account
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Set up your first email address to send and receive messages with Relaybase.
        </p>
      </div>

      <form onSubmit={handleCreateAccount} className="space-y-4">
        {/* Domain selection if multiple */}
        {readyDomains.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Select Domain</Label>
            <div className="flex flex-wrap gap-2">
              {readyDomains.map((d) => (
                <Badge
                  key={d.domain}
                  variant={selectedDomain === d.domain ? "default" : "outline"}
                  onClick={() => setSelectedDomain(d.domain)}
                  className="cursor-pointer py-1 px-2.5 text-xs"
                >
                  {d.domain}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Recommended Address Presets</Label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => {
              const isSelected = localPart.toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {preset}@{selectedDomain || "domain.com"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Local-part & Domain Input */}
        <div className="space-y-2">
          <Label htmlFor="account-local-part" className="text-xs font-medium sm:text-sm">
            Email Address
          </Label>
          <div className="flex rounded-md border bg-background shadow-xs focus-within:ring-1 focus-within:ring-ring">
            <div className="flex items-center pl-3 text-muted-foreground">
              <AtSign className="size-4" />
            </div>
            <Input
              id="account-local-part"
              value={localPart}
              onChange={(e) => {
                setLocalPart(e.target.value);
                setError(null);
              }}
              placeholder="team"
              className="border-0 focus-visible:ring-0 text-xs sm:text-sm pl-2 shadow-none"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <div className="flex items-center pr-3 font-mono text-xs text-muted-foreground sm:text-sm border-l bg-muted/20 px-3">
              @{selectedDomain || "domain.com"}
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="account-display-name" className="text-xs font-medium sm:text-sm">
            Sender Display Name
          </Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <User className="size-4" />
            </div>
            <Input
              id="account-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Acme Support or Jane Doe"
              className="pl-9 text-xs sm:text-sm"
              autoComplete="name"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            This name will appear as the sender in your recipients&apos; inboxes.
          </p>
        </div>

        {/* Inbound Mail Toggle */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="inbound-toggle" className="text-xs font-medium cursor-pointer sm:text-sm">
              Enable Inbound Routing
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Store incoming emails to this address in your Relaybase Inbox.
            </p>
          </div>
          <Switch
            id="inbound-toggle"
            checked={inboundEnabled}
            onCheckedChange={setInboundEnabled}
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-2">
          {onBack ? (
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>
              Back
            </Button>
          ) : <div />}

          <Button type="submit" disabled={submitting || !localPart.trim() || !selectedDomain} className="gap-2">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating Address…
              </>
            ) : (
              "Create Account & Finish"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
