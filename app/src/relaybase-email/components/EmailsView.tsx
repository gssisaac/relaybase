"use client";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import {
  fetchEmailCached,
  fetchEmailCachedOptional,
  clearEmailCache,
} from "@/relaybase-email/components/email-cached-fetch";
import { Inbox, Pencil, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";

import {
  RelaybaseConfigAlert,
  EmailAlerts,
  InboundEmailDetail,
  InboundR2ConfigAlert,
} from "@/relaybase-email/components/EmailShared";
import { readEmailStale } from "@/relaybase-email/components/useEmailViewLoading";
import {
  DetailView,
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
  SegmentTabs,
} from "@/relaybase-email/components/EmailListShell";
import type {
  Address,
  EmailConfig,
  MailListItem,
  RoutingActivityEvent,
  SentEmail,
} from "@/relaybase-email/components/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Segment = "receiving" | "sending";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function composeReplyHref(
  compose: string,
  event: RoutingActivityEvent,
  addresses: Address[],
) {
  const defaultFrom = addresses[0]?.email;
  const subject = event.subject.startsWith("Re:")
    ? event.subject
    : `Re: ${event.subject}`;
  const params = new URLSearchParams({
    reply: "1",
    to: event.fromEmail,
    subject,
  });
  if (defaultFrom) params.set("from", defaultFrom);
  return `${compose}?${params.toString()}`;
}

export function EmailsView() {
  const productId = useProductId();
  const { apiBase, emails, compose } = useEmailPaths();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [activity, setActivity] = useState<RoutingActivityEvent[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [segment, setSegment] = useState<Segment>("receiving");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityDetail, setActivityDetail] =
    useState<RoutingActivityEvent | null>(null);
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<EmailConfig>(productId, "config") === null &&
      readEmailStale<{ messages?: RoutingActivityEvent[] }>(productId, "inbox") ===
        null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const dataRef = useRef({ config, activity, sent });
  dataRef.current = { config, activity, sent };

  useEffect(() => {
    const staleConfig = readEmailStale<EmailConfig>(productId, "config");
    if (staleConfig) setConfig(staleConfig);
    const staleInbox = readEmailStale<{ messages?: RoutingActivityEvent[] }>(
      productId,
      "inbox",
    );
    if (staleInbox) setActivity(staleInbox.messages ?? []);
    const staleSent = readEmailStale<{ sent?: SentEmail[] }>(productId, "sent");
    if (staleSent) setSent(staleSent.sent ?? []);
    const staleAddresses = readEmailStale<{ addresses?: Address[] }>(
      productId,
      "addresses",
    );
    if (staleAddresses) setAddresses(staleAddresses.addresses ?? []);
    if (staleConfig || staleInbox) setLoading(false);
  }, [productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      const hasData =
        dataRef.current.config !== null ||
        dataRef.current.activity.length > 0 ||
        dataRef.current.sent.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const [cfgResult, inboxResult, sentResult, addrResult] =
          await Promise.all([
            fetchEmailCached<EmailConfig>(productId, "config", `${apiBase}/config`, {
              refresh: force,
              onUpdate: (data) => setConfig(data),
            }),
            fetchEmailCachedOptional<{ messages?: RoutingActivityEvent[] }>(
              productId,
              "inbox",
              `${apiBase}/inbox?limit=100`,
              {
                refresh: force,
                onUpdate: (data) => setActivity(data?.messages ?? []),
              },
            ),
            fetchEmailCachedOptional<{ sent?: SentEmail[] }>(
              productId,
              "sent",
              `${apiBase}/sent`,
              {
                refresh: force,
                onUpdate: (data) => setSent(data?.sent ?? []),
              },
            ),
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
        if (inboxResult.ok) {
          setActivity(inboxResult.data?.messages ?? []);
        } else {
          setActivity([]);
          setError("Failed to load received mail from Relaybase");
        }
        if (sentResult.ok) setSent(sentResult.data?.sent ?? []);
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

  useEffect(() => {
    function onUpdatesSynced() {
      clearEmailCache(productId, "inbox");
      if (segment === "receiving") {
        void refresh(true);
      }
    }

    window.addEventListener("ops-dashboard:updates-synced", onUpdatesSynced);
    return () => {
      window.removeEventListener("ops-dashboard:updates-synced", onUpdatesSynced);
    };
  }, [productId, refresh, segment]);

  useEffect(() => {
    if (searchParams.get("sent") === "1") {
      setSegment("sending");
      setMessage("Email sent");
      router.replace(emails);
    }
  }, [searchParams, router]);

  const items = useMemo((): MailListItem[] => {
    const q = search.trim().toLowerCase();
    const source =
      segment === "receiving"
        ? activity.map((m) => ({
            kind: "inbox" as const,
            id: `inbox:${m.key}`,
            message: m,
          }))
        : sent.map((m) => ({
            kind: "sent" as const,
            id: `sent:${m.id}`,
            message: m,
          }));

    return source
      .sort((a, b) => {
        const at =
          a.kind === "inbox" ? a.message.receivedAt : a.message.sentAt;
        const bt =
          b.kind === "inbox" ? b.message.receivedAt : b.message.sentAt;
        return new Date(bt).getTime() - new Date(at).getTime();
      })
      .filter((item) => {
        if (!q) return true;
        if (item.kind === "inbox") {
          return (
            item.message.subject.toLowerCase().includes(q) ||
            item.message.fromEmail.toLowerCase().includes(q)
          );
        }
        return (
          item.message.subject.toLowerCase().includes(q) ||
          item.message.to.toLowerCase().includes(q)
        );
      });
  }, [activity, sent, segment, search]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  function closeDetail() {
    setSelectedId(null);
    setActivityDetail(null);
  }

  async function openItem(item: MailListItem) {
    setSelectedId(item.id);
    if (item.kind === "sent") {
      setActivityDetail(null);
      return;
    }
    try {
      const res = await fetch(
        `${apiBase}/inbox/${encodeURIComponent(item.message.key)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setActivityDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load event");
    }
  }

  const relaybaseOk = config?.relaybaseConfigured ?? false;

  if (selected) {
    if (selected.kind === "sent") {
      const m = selected.message;
      return (
        <div className="space-y-3">
          <EmailAlerts error={error} message={message} />
          <EmailListContainer>
            <DetailView title={m.subject} onBack={closeDetail}>
              <p className="mb-4 text-xs text-muted-foreground">
                To {m.to} · From {m.from} · {formatDate(m.sentAt)}
              </p>
              <pre className="whitespace-pre-wrap text-sm">{m.bodyPreview}</pre>
            </DetailView>
          </EmailListContainer>
        </div>
      );
    }
    if (activityDetail) {
      return (
        <div className="space-y-3">
          <EmailAlerts error={error} message={message} />
          <EmailListContainer>
            <DetailView
              title={activityDetail.subject || "(no subject)"}
              onBack={closeDetail}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link href={composeReplyHref(compose, activityDetail, addresses)} />
                  }
                >
                  Reply
                </Button>
              }
            >
              <p className="mb-4 text-xs text-muted-foreground">
                From {activityDetail.fromEmail} · To {activityDetail.toEmail} ·{" "}
                {formatDate(activityDetail.receivedAt)}
              </p>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd>{activityDetail.status}</dd>
                </div>
                {activityDetail.action ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Action</dt>
                    <dd>{activityDetail.action}</dd>
                  </div>
                ) : null}
                {activityDetail.errorDetail ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Error</dt>
                    <dd className="text-destructive">
                      {activityDetail.errorDetail}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {activityDetail.bodyText || activityDetail.bodyHtml || (activityDetail.attachments?.length ?? 0) > 0 ? (
                <div className="mt-4">
                  <InboundEmailDetail
                    productId={productId}
                    messageKey={activityDetail.key}
                    bodyText={activityDetail.bodyText ?? activityDetail.bodyPreview ?? ""}
                    bodyHtml={activityDetail.bodyHtml ?? undefined}
                    attachments={activityDetail.attachments ?? []}
                  />
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  Activity log metadata only — Cloudflare Email Service does not
                  expose message bodies via REST API.
                </p>
              )}
            </DetailView>
          </EmailListContainer>
        </div>
      );
    }
    return (
      <div className="min-h-[min(70vh,560px)]">
        <EmailListContainer>
          <div className="min-h-[400px]" />
        </EmailListContainer>
      </div>
    );
  }

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentTabs
          value={segment}
          onChange={(v) => {
            setSegment(v);
            closeDetail();
          }}
          options={[
            { value: "sending", label: "Sending" },
            { value: "receiving", label: "Received" },
          ]}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!relaybaseOk}
            render={<Link href={compose} />}
          >
            <Pencil className="size-4" />
            Compose
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </div>

      <EmailAlerts error={error} message={message} />
      <RelaybaseConfigAlert show={!config?.relaybaseConfigured} />
      {segment === "receiving" ? <InboundR2ConfigAlert config={config} /> : null}

      <EmailListContainer>
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search…"
        />
        {items.length > 0 ? (
          <>
            <EmailTableHeader>
              <span>{segment === "receiving" ? "From" : "To"}</span>
              <span className="hidden sm:block">Subject</span>
              <span className="hidden sm:block">Date</span>
              <span className="text-right">Status</span>
            </EmailTableHeader>
            <div>
              {items.map((item) => {
                const isInbox = item.kind === "inbox";
                const primary = isInbox
                  ? item.message.fromEmail
                  : item.message.to;
                const subject = item.message.subject;
                const attachmentCount = isInbox
                  ? item.message.attachmentCount ?? item.message.attachments?.length ?? 0
                  : 0;
                const date = formatDate(
                  isInbox ? item.message.receivedAt : item.message.sentAt,
                );
                return (
                  <EmailTableRow
                    key={item.id}
                    onClick={() => openItem(item)}
                    primary={primary}
                    secondary={
                      isInbox ? `To ${item.message.toEmail}` : `From ${item.message.from}`
                    }
                    subject={
                      attachmentCount > 0
                        ? `${subject} (${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"})`
                        : subject
                    }
                    date={date}
                    status={
                      <Badge variant="outline" className="text-[10px]">
                        {isInbox ? item.message.status : "Sent"}
                      </Badge>
                    }
                  />
                );
              })}
            </div>
          </>
        ) : !loading ? (
          <EmptyListState
            icon={segment === "sending" ? Send : Inbox}
            title={
              segment === "sending"
                ? "No sent emails yet"
                : "No routing activity yet"
            }
            description={
              segment === "sending"
                ? "Compose an email to start sending from your domain."
                : "Route inbound mail to Relaybase and store it in R2, or enable Email Routing in settings."
            }
            action={
              segment === "sending" ? (
                <Button
                  size="sm"
                  disabled={!relaybaseOk}
                  render={<Link href={compose} />}
                >
                  Compose email
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="min-h-[200px]" />
        )}
      </EmailListContainer>
    </div>
  );
}
