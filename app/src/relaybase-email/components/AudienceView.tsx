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
import type { AudienceContact, EmailConfig } from "@/relaybase-email/components/types";
import { Badge } from "@/components/ui/badge";
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

export function AudienceView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [contacts, setContacts] = useState<AudienceContact[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<EmailConfig>(productId, "config") === null &&
      readEmailStale<{ contacts?: AudienceContact[] }>(productId, "audience") ===
        null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");

  const dataRef = useRef({ config, contacts });
  dataRef.current = { config, contacts };

  useEffect(() => {
    const staleConfig = readEmailStale<EmailConfig>(productId, "config");
    if (staleConfig) setConfig(staleConfig);
    const staleAudience = readEmailStale<{ contacts?: AudienceContact[] }>(
      productId,
      "audience",
    );
    if (staleAudience) setContacts(staleAudience.contacts ?? []);
    if (staleConfig || staleAudience) setLoading(false);
  }, [productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      const hasData =
        dataRef.current.config !== null || dataRef.current.contacts.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const [cfgResult, audResult] = await Promise.all([
          fetchEmailCached<EmailConfig>(productId, "config", `${apiBase}/config`, {
            refresh: force,
            onUpdate: (data) => setConfig(data),
          }),
          fetchEmailCachedOptional<{ contacts?: AudienceContact[] }>(
            productId,
            "audience",
            `${apiBase}/audience`,
            {
              refresh: force,
              onUpdate: (data) => setContacts(data?.contacts ?? []),
            },
          ),
        ]);
        setConfig(cfgResult.data);
        if (audResult.ok) setContacts(audResult.data?.contacts ?? []);
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
    return contacts
      .filter(
        (c) =>
          !q ||
          c.email.toLowerCase().includes(q) ||
          (c.name?.toLowerCase().includes(q) ?? false),
      )
      .map((c) => ({
        key: c.email,
        primary: c.name || c.email,
        subject: c.name ? c.email : "Subscriber",
        contact: c,
      }));
  }, [contacts, search]);

  const selectedContact = contacts.find((c) => c.email === selectedKey);

  async function addSubscriber() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/audience`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contactEmail,
          name: contactName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      setContactEmail("");
      setContactName("");
      setAddOpen(false);
      setMessage(`Added ${data.contact.email}`);
      clearEmailCache(productId, "audience");
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function removeSubscriber(email: string) {
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/audience?email=${encodeURIComponent(email)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to remove");
      setSelectedKey(null);
      clearEmailCache(productId, "audience");
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    }
  }

  if (selectedKey && selectedContact) {
    return (
      <div className="space-y-3">
        <EmailAlerts error={error} message={message} />
        <EmailListContainer>
          <DetailView
            title={selectedContact.name || selectedContact.email}
            onBack={() => setSelectedKey(null)}
            actions={
              <Button
                size="sm"
                variant="destructive"
                onClick={() => removeSubscriber(selectedContact.email)}
              >
                Remove
              </Button>
            }
          >
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="font-mono">{selectedContact.email}</dd>
              </div>
              {selectedContact.name ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd>{selectedContact.name}</dd>
                </div>
              ) : null}
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
              Add subscriber
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add subscriber</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name (optional)</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                size="sm"
                disabled={saving || !contactEmail.trim()}
                onClick={addSubscriber}
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
              <span>Name</span>
              <span className="hidden sm:block">Email</span>
              <span />
              <span className="text-right">Status</span>
            </EmailTableHeader>
            <div>
              {rows.map((row) => (
                <EmailTableRow
                  key={row.key}
                  onClick={() => setSelectedKey(row.key)}
                  primary={row.primary}
                  subject={row.subject}
                  date=""
                  status={
                    <Badge variant="outline" className="text-[10px]">
                      Active
                    </Badge>
                  }
                />
              ))}
            </div>
          </>
        ) : !loading ? (
          <EmptyListState
            title="No subscribers yet"
            description="Add subscribers to send broadcasts."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                Add subscriber
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
