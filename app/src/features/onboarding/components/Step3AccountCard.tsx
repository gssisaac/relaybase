"use client";

import { useState, useMemo, useEffect } from "react";
import { AtSign, Loader2, Plus, User, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { appendEnabledMailAccounts } from "@/email/lib/accounts/enabled-accounts";
import { useAccounts } from "@/lib/dashboard/AccountsContext";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { suggestedDisplayNameForLocalPart } from "@/lib/dashboard/default-addresses";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { getHqUser } from "@/lib/hq-auth/session";

const RECOMMENDED_LOCAL_PARTS = ["hello", "contact", "team"] as const;

type QueuedAddress = {
  localPart: string;
  displayName: string;
};

function normalizeLocalPart(raw: string): string {
  return raw.trim().toLowerCase();
}

export function Step3AccountCard({
  defaultDomain,
  onComplete,
  onBack,
}: {
  defaultDomain: string;
  onComplete: (result: { primaryEmail: string; emails: string[] }) => void;
  onBack?: () => void;
}) {
  const accountsStore = useAccounts();
  const domainStore = useDomain();
  const productId = useProductId();
  const user = getHqUser();

  const readyDomains = useMemo(
    () => domainStore.domains.filter((d) => !d.onboarding || d.onboarding.status === "ready"),
    [domainStore.domains],
  );

  const [selectedDomain, setSelectedDomain] = useState(
    defaultDomain || readyDomains[0]?.domain || "",
  );

  const [queue, setQueue] = useState<QueuedAddress[]>([]);
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inboundEnabled, setInboundEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDomain && readyDomains.length > 0) {
      setSelectedDomain(readyDomains[0]!.domain);
    }
  }, [readyDomains, selectedDomain]);

  const domainSuffix = selectedDomain || "domain.com";

  const presets = useMemo(() => {
    const list: string[] = [];
    const username = user?.username?.trim().toLowerCase();
    if (username) list.push(username);
    for (const part of RECOMMENDED_LOCAL_PARTS) {
      if (!list.includes(part)) list.push(part);
    }
    return list;
  }, [user?.username]);

  const queuedLocalParts = useMemo(
    () => new Set(queue.map((item) => item.localPart)),
    [queue],
  );

  function addToQueue(part: string, nameOverride?: string) {
    const cleanDomain = selectedDomain.trim().toLowerCase();
    if (!cleanDomain) {
      setError("Please select a domain.");
      return;
    }
    const lp = normalizeLocalPart(part);
    if (!lp) {
      setError("Enter a mailbox name (e.g. team or hello).");
      return;
    }
    if (!/^[a-z0-9._+-]+$/.test(lp)) {
      setError("Use letters, numbers, dots, hyphens, or underscores only.");
      return;
    }
    if (queuedLocalParts.has(lp)) {
      toast.message(`${lp}@${cleanDomain} is already in the list.`);
      return;
    }
    const display =
      nameOverride?.trim() || suggestedDisplayNameForLocalPart(lp) || lp;
    setQueue((prev) => [...prev, { localPart: lp, displayName: display }]);
    setLocalPart("");
    setDisplayName("");
    setError(null);
  }

  function addFromInput() {
    const name =
      displayName.trim() || suggestedDisplayNameForLocalPart(localPart);
    addToQueue(localPart, name);
  }

  function removeFromQueue(local: string) {
    setQueue((prev) => prev.filter((item) => item.localPart !== local));
    setError(null);
  }

  function resolveQueueForSubmit(): QueuedAddress[] {
    const items = [...queue];
    const draft = normalizeLocalPart(localPart);
    if (draft && !items.some((item) => item.localPart === draft)) {
      items.push({
        localPart: draft,
        displayName:
          displayName.trim() || suggestedDisplayNameForLocalPart(draft),
      });
    }
    return items;
  }

  async function handleCreateAccounts(e: React.FormEvent) {
    e.preventDefault();
    const cleanDomain = selectedDomain.trim().toLowerCase();
    if (!cleanDomain) {
      setError("Please select a domain.");
      return;
    }

    const toCreate = resolveQueueForSubmit();
    if (!toCreate.length) {
      setError("Add at least one email address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const displayNames = Object.fromEntries(
        toCreate.map((item) => [item.localPart, item.displayName]),
      );
      await accountsStore.create(cleanDomain, {
        localParts: toCreate.map((item) => item.localPart),
        displayNames,
        inboundEnabled,
      });

      const emails = toCreate.map(
        (item) => `${item.localPart}@${cleanDomain}`.toLowerCase(),
      );
      await appendEnabledMailAccounts(productId, emails);
      toast.success(
        emails.length === 1
          ? `Account ${emails[0]} created successfully!`
          : `Created ${emails.length} mail accounts.`,
      );
      onComplete({ primaryEmail: emails[0]!, emails });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account addresses.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    queue.length > 0 || normalizeLocalPart(localPart).length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">
          Step 3: Create Mail Accounts
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Add one or more addresses to send and receive mail. They appear in your mailbox sidebar
          after setup.
        </p>
      </div>

      <form onSubmit={handleCreateAccounts} className="space-y-4">
        {readyDomains.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Select Domain</Label>
            <div className="flex flex-wrap gap-2">
              {readyDomains.map((d) => (
                <Badge
                  key={d.domain}
                  variant={selectedDomain === d.domain ? "default" : "outline"}
                  onClick={() => setSelectedDomain(d.domain)}
                  className="cursor-pointer px-2.5 py-1 text-xs"
                >
                  {d.domain}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Recommended</Label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => {
              const inQueue = queuedLocalParts.has(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={inQueue}
                  onClick={() => addToQueue(preset)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    inQueue
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {preset}@{domainSuffix}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Click a recommendation to add it to the list below.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-local-part" className="text-xs font-medium sm:text-sm">
            Email Address
          </Label>
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 rounded-md border bg-background shadow-xs focus-within:ring-1 focus-within:ring-ring">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFromInput();
                  }
                }}
                placeholder="team"
                className="border-0 pl-2 text-xs shadow-none focus-visible:ring-0 sm:text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex items-center border-l bg-muted/20 px-3 font-mono text-xs text-muted-foreground sm:text-sm">
                @{domainSuffix}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1"
              disabled={!normalizeLocalPart(localPart)}
              onClick={addFromInput}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>

          {queue.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {queue.map((item) => (
                <Badge
                  key={item.localPart}
                  variant="secondary"
                  className="gap-1 py-1 pl-2.5 pr-1 font-mono text-[11px] sm:text-xs"
                >
                  {item.localPart}@{domainSuffix}
                  <button
                    type="button"
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${item.localPart}@${domainSuffix}`}
                    onClick={() => removeFromQueue(item.localPart)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No addresses added yet — use Recommended or type a name and click Add.
            </p>
          )}
        </div>

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
              placeholder="Used for the next address you add (optional)"
              className="pl-9 text-xs sm:text-sm"
              autoComplete="name"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Applies to manual Add only; recommended presets use sensible defaults.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="inbound-toggle" className="cursor-pointer text-xs font-medium sm:text-sm">
              Enable Inbound Routing
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Store incoming mail for these addresses in your Relaybase Inbox.
            </p>
          </div>
          <Switch
            id="inbound-toggle"
            checked={inboundEnabled}
            onCheckedChange={setInboundEnabled}
          />
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex items-center justify-between pt-2">
          {onBack ? (
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>
              Back
            </Button>
          ) : (
            <div />
          )}

          <Button
            type="submit"
            disabled={submitting || !canSubmit || !selectedDomain}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Accounts & Finish"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
