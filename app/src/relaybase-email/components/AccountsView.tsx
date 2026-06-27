"use client";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import {
  clearEmailCache,
  fetchEmailCached,
  fetchEmailCachedOptional,
} from "@/relaybase-email/components/email-cached-fetch";
import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";

import {
  CloudflareConfigAlert,
  EmailAlerts,
} from "@/relaybase-email/components/EmailShared";
import { readEmailStale } from "@/relaybase-email/components/useEmailViewLoading";
import {
  DetailView,
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/relaybase-email/components/EmailListShell";
import type { Address, EmailConfig } from "@/relaybase-email/components/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountsView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<EmailConfig>(productId, "config") === null &&
      readEmailStale<{ addresses?: Address[] }>(productId, "addresses") === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localPart, setLocalPart] = useState("");

  const domain = config?.domain ?? "";

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
            "addresses",
            `${apiBase}/addresses`,
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
    [apiBase, productId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return addresses
      .filter((a) => !q || a.email.toLowerCase().includes(q))
      .map((a) => ({
        key: a.email,
        primary: a.email,
        subject: "Registered sender",
      }));
  }, [addresses, search]);

  const selectedSender = addresses.find((a) => a.email === selectedKey);

  async function addSender() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localPart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      setLocalPart("");
      setAddOpen(false);
      setMessage(`Registered ${data.address.email}`);
      clearEmailCache(productId, "addresses");
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  if (selectedKey && selectedSender) {
    return (
      <div className="space-y-3">
        <EmailAlerts error={error} message={message} />
        <EmailListContainer>
          <DetailView
            title={selectedSender.email}
            onBack={() => setSelectedKey(null)}
          >
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Address</dt>
                <dd>{selectedSender.email}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  Available for sending once your domain is onboarded on
                  Cloudflare Email Sending.
                </dd>
              </div>
            </dl>
          </DetailView>
        </EmailListContainer>
      </div>
    );
  }

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger>
            <Button size="sm">
              <Plus className="size-4" />
              Add sender
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add sender</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Alert>
                <AlertDescription className="text-xs">
                  Register addresses on your onboarded domain. Cloudflare does
                  not require per-address verification once the domain is set up.
                </AlertDescription>
              </Alert>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Local part</Label>
                  <Input
                    value={localPart}
                    onChange={(e) => setLocalPart(e.target.value)}
                    placeholder="support"
                  />
                </div>
                <span className="pb-2 text-sm text-muted-foreground">
                  @{domain}
                </span>
              </div>
              <Button
                className="w-full"
                size="sm"
                disabled={saving || !localPart.trim()}
                onClick={addSender}
              >
                {saving ? "Adding…" : "Add"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </Button>
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
                  onClick={() => setSelectedKey(row.key)}
                  primary={row.primary}
                  subject={row.subject}
                  date=""
                />
              ))}
            </div>
          </>
        ) : !loading ? (
          <EmptyListState
            title="No senders yet"
            description="Register a sender address on your domain."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                Add sender
              </Button>
            }
          />
        ) : (
          <div className="min-h-[200px]" />
        )}
      </EmailListContainer>
    </div>
  );
}
