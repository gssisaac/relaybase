"use client";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import {
  clearEmailCache,
  fetchEmailCached,
  fetchEmailCachedOptional,
} from "@/relaybase-email/components/email-cached-fetch";
import Link from "next/link";
import { Megaphone, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  RelaybaseConfigAlert,
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
import type {
  Address,
  EmailBroadcast,
  EmailConfig,
} from "@/relaybase-email/components/types";
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
import { Textarea } from "@/components/ui/textarea";

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" {
  if (status === "sent") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

export function BroadcastsView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [broadcasts, setBroadcasts] = useState<EmailBroadcast[]>([]);
  const [audienceCount, setAudienceCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<EmailConfig>(productId, "config") === null &&
      readEmailStale<{ broadcasts?: EmailBroadcast[] }>(productId, "broadcasts") ===
        null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendFrom, setSendFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const dataRef = useRef({ config, broadcasts, sendFrom });
  dataRef.current = { config, broadcasts, sendFrom };

  useEffect(() => {
    const staleConfig = readEmailStale<EmailConfig>(productId, "config");
    if (staleConfig) setConfig(staleConfig);
    const staleAddresses = readEmailStale<{ addresses?: Address[] }>(
      productId,
      "addresses",
    );
    if (staleAddresses) {
      const list = staleAddresses.addresses ?? [];
      setAddresses(list);
      if (list.length) setSendFrom((prev) => prev || list[0].email);
    }
    const staleBroadcasts = readEmailStale<{ broadcasts?: EmailBroadcast[] }>(
      productId,
      "broadcasts",
    );
    if (staleBroadcasts) setBroadcasts(staleBroadcasts.broadcasts ?? []);
    const staleAudience = readEmailStale<{ contacts?: unknown[] }>(
      productId,
      "audience",
    );
    if (staleAudience) {
      setAudienceCount(staleAudience.contacts?.length ?? 0);
    }
    if (staleConfig || staleBroadcasts) setLoading(false);
  }, [productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      const hasData =
        dataRef.current.config !== null || dataRef.current.broadcasts.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const [cfgResult, addrResult, bcResult, audResult] = await Promise.all([
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
              onUpdate: (data) => {
                const list = data?.addresses ?? [];
                setAddresses(list);
                if (list.length) setSendFrom((prev) => prev || list[0].email);
              },
            },
          ),
          fetchEmailCachedOptional<{ broadcasts?: EmailBroadcast[] }>(
            productId,
            "broadcasts",
            `${apiBase}/broadcasts`,
            {
              refresh: force,
              onUpdate: (data) => setBroadcasts(data?.broadcasts ?? []),
            },
          ),
          fetchEmailCachedOptional<{ contacts?: unknown[] }>(
            productId,
            "audience",
            `${apiBase}/audience`,
            {
              refresh: force,
              onUpdate: (data) => setAudienceCount(data?.contacts?.length ?? 0),
            },
          ),
        ]);
        setConfig(cfgResult.data);
        if (addrResult.ok) {
          const list = addrResult.data?.addresses ?? [];
          setAddresses(list);
          if (list.length && !dataRef.current.sendFrom) setSendFrom(list[0].email);
        }
        if (bcResult.ok) setBroadcasts(bcResult.data?.broadcasts ?? []);
        if (audResult.ok) {
          setAudienceCount(audResult.data?.contacts?.length ?? 0);
        }
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return broadcasts.filter(
      (b) =>
        !q ||
        b.subject.toLowerCase().includes(q) ||
        b.from.toLowerCase().includes(q),
    );
  }, [broadcasts, search]);

  const selected = filtered.find((b) => b.id === selectedId) ?? null;

  async function sendBroadcast() {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/broadcasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: sendFrom, subject, text: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Broadcast failed");
      setCreateOpen(false);
      setSubject("");
      setBody("");
      setSelectedId(data.broadcast.id);
      setMessage(`Sent to ${data.broadcast.recipientCount} recipients`);
      clearEmailCache(productId, "broadcasts");
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  const relaybaseOk = config?.relaybaseConfigured ?? false;

  if (selected) {
    return (
      <div className="space-y-3">
        <EmailAlerts error={error} message={message} />
        <EmailListContainer>
          <DetailView
            title={selected.subject}
            onBack={() => setSelectedId(null)}
          >
            <p className="mb-4 text-xs text-muted-foreground">
              {selected.recipientCount} recipients · From {selected.from} ·{" "}
              {new Date(selected.sentAt ?? selected.createdAt).toLocaleString()}
            </p>
            <Badge variant={statusVariant(selected.status)} className="mb-4">
              {selected.status}
            </Badge>
            <pre className="whitespace-pre-wrap text-sm">{selected.body}</pre>
          </DetailView>
        </EmailListContainer>
      </div>
    );
  }

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <div className="flex justify-end gap-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button size="sm" disabled={!relaybaseOk || audienceCount === 0}>
              <Megaphone className="size-4" />
              New broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New broadcast</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Sends to {audienceCount} subscriber
              {audienceCount === 1 ? "" : "s"}
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={sendFrom}
                  onChange={(e) => setSendFrom(e.target.value)}
                >
                  <option value="">Select sender</option>
                  {addresses.map((a) => (
                    <option key={a.email} value={a.email}>
                      {a.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
              </div>
              <Button
                className="w-full"
                size="sm"
                onClick={sendBroadcast}
                disabled={sending || !sendFrom || !subject || !body}
              >
                {sending ? "Sending…" : "Send broadcast"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      <EmailAlerts error={error} message={message} />
      <RelaybaseConfigAlert show={!relaybaseOk} />

      {audienceCount === 0 ? (
        <Alert>
          <AlertTitle>No audience</AlertTitle>
          <AlertDescription>
            Add subscribers in{" "}
            <Link href="/products/macpurity/email/audience" className="underline">
              Audience
            </Link>{" "}
            first.
          </AlertDescription>
        </Alert>
      ) : null}

      <EmailListContainer>
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search broadcasts…"
        />
        {filtered.length > 0 ? (
          <>
            <EmailTableHeader>
              <span>Subject</span>
              <span className="hidden sm:block">From</span>
              <span className="hidden sm:block">Date</span>
              <span className="text-right">Status</span>
            </EmailTableHeader>
            <div>
              {filtered.map((b) => (
                <EmailTableRow
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  primary={b.subject}
                  subject={b.from}
                  date={new Date(b.sentAt ?? b.createdAt).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric" },
                  )}
                  status={
                    <Badge variant={statusVariant(b.status)} className="text-[10px]">
                      {b.status}
                    </Badge>
                  }
                />
              ))}
            </div>
          </>
        ) : !loading ? (
          <EmptyListState
            icon={Megaphone}
            title="No broadcasts yet"
            description="Send a broadcast to your audience subscribers."
            action={
              <Button
                size="sm"
                disabled={!relaybaseOk || audienceCount === 0}
                onClick={() => setCreateOpen(true)}
              >
                New broadcast
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
