"use client";

import { useDashboardPaths } from "@/dashboard/paths";
import {
  clearEmailCache,
  fetchEmailCached,
  fetchEmailCachedOptional,
} from "@/email/components/email-cached-fetch";
import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDashboardDomain } from "@/dashboard/hooks/useDashboardDomain";
import {
  DEFAULT_ADDRESS_DISPLAY_NAMES,
  DEFAULT_ADDRESS_LOCAL_PARTS,
  suggestedDisplayNameForLocalPart,
} from "@/lib/dashboard/DomainContext";

import {
  CloudflareConfigAlert,
  EmailAlerts,
} from "@/email/components/EmailShared";
import { DomainScopedLayout } from "@/dashboard/components/DomainScopedLayout";
import { readEmailStale } from "@/email/components/useEmailViewLoading";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/EmailListShell";
import type { Address, EmailConfig } from "@/email/components/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldCheck } from "@/components/ui/field-check";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function initialDefaultSelection(): Record<string, boolean> {
  return Object.fromEntries(
    DEFAULT_ADDRESS_LOCAL_PARTS.map((part) => [part, true]),
  );
}

export function AccountsView() {
  const productId = useProductId();
  const { apiBase, accounts } = useDashboardPaths();
  const { domain: urlDomain, domainQuery } = useDashboardDomain();
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<EmailConfig>(productId, "config") === null &&
      readEmailStale<{ addresses?: Address[] }>(productId, "addresses") === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [selectedDefaults, setSelectedDefaults] = useState(
    initialDefaultSelection,
  );
  const [saving, setSaving] = useState(false);
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");

  const domain = urlDomain ?? config?.domain ?? "";
  const domainKey = urlDomain ?? "none";

  const dataRef = useRef({ config, addresses });
  dataRef.current = { config, addresses };

  useEffect(() => {
    const staleConfig = readEmailStale<EmailConfig>(productId, "config");
    if (staleConfig) setConfig(staleConfig);
    const staleAddresses = readEmailStale<{ addresses?: Address[] }>(
      productId,
      "addresses",
    );
    if (staleAddresses) setAddresses(staleAddresses.addresses ?? []);
    if (staleConfig || staleAddresses) setLoading(false);
  }, [productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      if (!urlDomain) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const hasData =
        dataRef.current.config !== null || dataRef.current.addresses.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const [cfgResult, addrResult] = await Promise.all([
          fetchEmailCached<EmailConfig>(productId, "config", `${apiBase}/config`, {
            refresh: force,
            onUpdate: (data) => setConfig(data),
          }),
          fetchEmailCachedOptional<{ addresses?: Address[] }>(
            productId,
            `addresses:${domainKey}`,
            `${apiBase}/addresses${domainQuery()}`,
            {
              refresh: force,
              onUpdate: (data) => setAddresses(data?.addresses ?? []),
            },
          ),
        ]);
        setConfig(cfgResult.data);
        if (addrResult.ok) setAddresses(addrResult.data?.addresses ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, domainKey, domainQuery, productId, urlDomain],
  );

  useEffect(() => {
    refresh();
  }, [refresh, urlDomain]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return addresses
      .filter((a) => !q || a.email.toLowerCase().includes(q))
      .map((a) => ({
        key: a.email,
        primary: a.email,
        subject: a.displayName?.trim() || "Send and receive",
      }));
  }, [addresses, search]);

  const selectedDefaultParts = useMemo(
    () => DEFAULT_ADDRESS_LOCAL_PARTS.filter((part) => selectedDefaults[part]),
    [selectedDefaults],
  );

  function openDefaultsDialog() {
    setSelectedDefaults(initialDefaultSelection());
    setDefaultsOpen(true);
  }

  async function addAccount() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/addresses${domainQuery()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localPart,
          displayName:
            displayName.trim() ||
            suggestedDisplayNameForLocalPart(localPart),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      setLocalPart("");
      setDisplayName("");
      setAddOpen(false);
      setMessage(`Registered ${data.address.email}`);
      clearEmailCache(productId, `addresses:${domainKey}`);
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function addDefaultAccounts() {
    if (!selectedDefaultParts.length) return;
    setSaving(true);
    setError(null);
    try {
      const displayNames = Object.fromEntries(
        selectedDefaultParts.map((part) => [
          part,
          DEFAULT_ADDRESS_DISPLAY_NAMES[part],
        ]),
      );
      const res = await fetch(`${apiBase}/addresses${domainQuery()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localParts: [...selectedDefaultParts],
          displayNames,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      const emails = (data.addresses as { email: string }[] | undefined)?.map(
        (a) => a.email,
      );
      setDefaultsOpen(false);
      setSelectedDefaults(initialDefaultSelection());
      setMessage(
        emails?.length
          ? `Registered ${emails.length} account${emails.length === 1 ? "" : "s"}`
          : "Standard accounts added",
      );
      clearEmailCache(productId, `addresses:${domainKey}`);
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DomainScopedLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {domain || "Accounts"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Accounts for the selected domain
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open);
              if (!open) {
                setLocalPart("");
                setDisplayName("");
              }
            }}
          >
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" />
              Add account
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add account</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Alert>
                  <AlertDescription className="text-xs">
                    Adds a send-from address and creates an Email Routing rule
                    so replies to this address land in Inbox. No per-address
                    verification once the domain is onboarded.
                  </AlertDescription>
                </Alert>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Local part</Label>
                    <Input
                      value={localPart}
                      onChange={(e) => {
                        const next = e.target.value;
                        setLocalPart(next);
                        setDisplayName(suggestedDisplayNameForLocalPart(next));
                      }}
                      placeholder="support"
                    />
                  </div>
                  <span className="pb-2 text-sm text-muted-foreground">
                    @{domain}
                  </span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Display name</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Support Team"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown as the From name when sending from this address.
                  </p>
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={saving || !localPart.trim() || !domain}
                  onClick={addAccount}
                >
                  {saving ? "Adding…" : "Add"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog
            open={defaultsOpen}
            onOpenChange={(open) => {
              setDefaultsOpen(open);
              if (open) setSelectedDefaults(initialDefaultSelection());
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add standard accounts</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Create the usual product addresses on{" "}
                  <span className="font-mono">{domain || "your domain"}</span>.
                  Uncheck any you do not need.
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {DEFAULT_ADDRESS_LOCAL_PARTS.map((part) => (
                    <FieldCheck
                      key={part}
                      id={`default-account-${part}`}
                      checked={Boolean(selectedDefaults[part])}
                      onCheckedChange={(on) =>
                        setSelectedDefaults((prev) => ({
                          ...prev,
                          [part]: on,
                        }))
                      }
                      label={`${part}@${domain || "…"}`}
                      description={DEFAULT_ADDRESS_DISPLAY_NAMES[part]}
                    />
                  ))}
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={
                    saving || !domain || selectedDefaultParts.length === 0
                  }
                  onClick={addDefaultAccounts}
                >
                  {saving
                    ? "Adding…"
                    : `Add selected (${selectedDefaultParts.length})`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={refreshing ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        </div>
      </div>

      <EmailAlerts error={error} message={message} />
      <CloudflareConfigAlert show={!config?.cloudflareConfigured} />

      <EmailListContainer>
        <ListToolbar search={search} onSearchChange={setSearch} />
        {rows.length > 0 ? (
          <>
            <EmailTableHeader>
              <span>Address</span>
              <span className="hidden sm:block">Detail</span>
              <span />
              <span />
            </EmailTableHeader>
            <div>
              {rows.map((row) => (
                <EmailTableRow
                  key={row.key}
                  href={`${accounts}/${encodeURIComponent(row.key)}`}
                  primary={row.primary}
                  subject={row.subject}
                  date=""
                />
              ))}
            </div>
          </>
        ) : !loading ? (
          <EmptyListState
            title="No accounts yet"
            description="Add an address to send from and receive mail on your domain."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Add account
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openDefaultsDialog}
                  disabled={!domain}
                >
                  Add defaults 6 accounts
                </Button>
              </div>
            }
          />
        ) : (
          <div className="min-h-[200px]" />
        )}
      </EmailListContainer>
    </DomainScopedLayout>
  );
}
