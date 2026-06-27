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
import { useDomain } from "@/lib/dashboard/DomainContext";

import {
  EmailAccountSelect,
  type EmailAccountFilter,
} from "@/relaybase-email/components/EmailAccountSelect";
import {
  EmailMailboxFrame,
  type EmailFolder,
} from "@/relaybase-email/components/EmailMailboxLayout";
import {
  RelaybaseConfigAlert,
  EmailAlerts,
  InboundEmailDetail,
  InboundR2ConfigAlert,
} from "@/relaybase-email/components/EmailShared";
import { CurrentDomainSelect } from "@/relaybase-email/components/CurrentDomainSelect";
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
  EmailConfig,
  MailListItem,
  RoutingActivityEvent,
  SentEmail,
} from "@/relaybase-email/components/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  fromAccount?: EmailAccountFilter,
) {
  const defaultFrom =
    fromAccount && fromAccount !== "all"
      ? fromAccount
      : addresses[0]?.email;
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

function composeHref(compose: string, fromAccount: EmailAccountFilter) {
  if (fromAccount === "all") return compose;
  return `${compose}?from=${encodeURIComponent(fromAccount)}`;
}

function matchesAccount(
  item: MailListItem,
  account: EmailAccountFilter,
): boolean {
  if (account === "all") return true;
  const needle = account.toLowerCase();
  if (item.kind === "inbox") {
    return item.message.toEmail.toLowerCase() === needle;
  }
  return item.message.from.toLowerCase() === needle;
}

export function EmailsView() {
  const productId = useProductId();
  const { apiBase, emails, compose } = useEmailPaths();
  const { activeDomain, domainQuery } = useDomain();
  const domainKey = activeDomain ?? "none";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [activity, setActivity] = useState<RoutingActivityEvent[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [folder, setFolder] = useState<EmailFolder>("inbox");
  const [accountFilter, setAccountFilter] = useState<EmailAccountFilter>("all");
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
              `inbox:${domainKey}`,
              `${apiBase}/inbox${domainQuery({ limit: "100" })}`,
              {
                refresh: force,
                onUpdate: (data) => setActivity(data?.messages ?? []),
              },
            ),
            fetchEmailCachedOptional<{ sent?: SentEmail[] }>(
              productId,
              `sent:${domainKey}`,
              `${apiBase}/sent${domainQuery()}`,
              {
                refresh: force,
                onUpdate: (data) => setSent(data?.sent ?? []),
              },
            ),
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
    [apiBase, domainKey, domainQuery, productId],
  );

  useEffect(() => {
    refresh();
  }, [refresh, activeDomain]);

  useEffect(() => {
    setAccountFilter("all");
    setSelectedId(null);
    setActivityDetail(null);
  }, [activeDomain]);

  useEffect(() => {
    if (
      accountFilter !== "all" &&
      !addresses.some((a) => a.email === accountFilter)
    ) {
      setAccountFilter("all");
    }
  }, [accountFilter, addresses]);

  useEffect(() => {
    function onUpdatesSynced() {
      clearEmailCache(productId, `inbox:${domainKey}`);
      if (folder === "inbox") {
        void refresh(true);
      }
    }

    window.addEventListener("ops-dashboard:updates-synced", onUpdatesSynced);
    return () => {
      window.removeEventListener("ops-dashboard:updates-synced", onUpdatesSynced);
    };
  }, [domainKey, folder, productId, refresh]);

  useEffect(() => {
    if (searchParams.get("sent") === "1") {
      setFolder("sent");
      setMessage("Email sent");
      router.replace(emails);
    }
  }, [emails, router, searchParams]);

  const inboxItems = useMemo(
    () =>
      activity
        .filter((m) => matchesAccount(
          { kind: "inbox", id: `inbox:${m.key}`, message: m },
          accountFilter,
        ))
        .map((m) => ({
          kind: "inbox" as const,
          id: `inbox:${m.key}`,
          message: m,
        })),
    [accountFilter, activity],
  );

  const sentItems = useMemo(
    () =>
      sent
        .filter((m) =>
          matchesAccount(
            { kind: "sent", id: `sent:${m.id}`, message: m },
            accountFilter,
          ),
        )
        .map((m) => ({
          kind: "sent" as const,
          id: `sent:${m.id}`,
          message: m,
        })),
    [accountFilter, sent],
  );

  const items = useMemo((): MailListItem[] => {
    const q = search.trim().toLowerCase();
    const source = folder === "inbox" ? inboxItems : sentItems;

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
            item.message.fromEmail.toLowerCase().includes(q) ||
            item.message.toEmail.toLowerCase().includes(q)
          );
        }
        return (
          item.message.subject.toLowerCase().includes(q) ||
          item.message.to.toLowerCase().includes(q) ||
          item.message.from.toLowerCase().includes(q)
        );
      });
  }, [folder, inboxItems, search, sentItems]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  function closeDetail() {
    setSelectedId(null);
    setActivityDetail(null);
  }

  function changeFolder(next: EmailFolder) {
    setFolder(next);
    closeDetail();
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

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CurrentDomainSelect />
        <EmailAccountSelect
          addresses={addresses}
          value={accountFilter}
          onChange={(value) => {
            setAccountFilter(value);
            closeDetail();
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!relaybaseOk || !activeDomain}
          render={<Link href={composeHref(compose, accountFilter)} />}
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
  );

  const alerts = (
    <>
      <EmailAlerts error={error} message={message} />
      <RelaybaseConfigAlert show={!config?.relaybaseConfigured} />
      {folder === "inbox" ? <InboundR2ConfigAlert config={config} /> : null}
    </>
  );

  if (selected) {
    if (selected.kind === "sent") {
      const m = selected.message;
      return (
        <EmailMailboxFrame
          folder={folder}
          onFolderChange={changeFolder}
          inboxCount={inboxItems.length}
          sentCount={sentItems.length}
          toolbar={toolbar}
          alerts={alerts}
        >
          <EmailListContainer plain>
            <DetailView title={m.subject} onBack={closeDetail}>
              <p className="mb-4 text-xs text-muted-foreground">
                To {m.to} · From {m.from} · {formatDate(m.sentAt)}
              </p>
              <pre className="whitespace-pre-wrap text-sm">{m.bodyPreview}</pre>
            </DetailView>
          </EmailListContainer>
        </EmailMailboxFrame>
      );
    }
    if (activityDetail) {
      return (
        <EmailMailboxFrame
          folder={folder}
          onFolderChange={changeFolder}
          inboxCount={inboxItems.length}
          sentCount={sentItems.length}
          toolbar={toolbar}
          alerts={alerts}
        >
          <EmailListContainer plain>
            <DetailView
              title={activityDetail.subject || "(no subject)"}
              onBack={closeDetail}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      href={composeReplyHref(
                        compose,
                        activityDetail,
                        addresses,
                        accountFilter,
                      )}
                    />
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
              {activityDetail.bodyText ||
              activityDetail.bodyHtml ||
              (activityDetail.attachments?.length ?? 0) > 0 ? (
                <div className="mt-4">
                  <InboundEmailDetail
                    productId={productId}
                    messageKey={activityDetail.key}
                    bodyText={
                      activityDetail.bodyText ??
                      activityDetail.bodyPreview ??
                      ""
                    }
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
        </EmailMailboxFrame>
      );
    }
    return (
      <EmailMailboxFrame
        folder={folder}
        onFolderChange={changeFolder}
        inboxCount={inboxItems.length}
        sentCount={sentItems.length}
        toolbar={toolbar}
        alerts={alerts}
      >
        <EmailListContainer plain>
          <div className="min-h-[400px]" />
        </EmailListContainer>
      </EmailMailboxFrame>
    );
  }

  return (
    <EmailMailboxFrame
      folder={folder}
      onFolderChange={changeFolder}
      inboxCount={inboxItems.length}
      sentCount={sentItems.length}
      toolbar={toolbar}
      alerts={alerts}
    >
      <EmailListContainer plain>
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search mail…"
        />
        {items.length > 0 ? (
          <>
            <EmailTableHeader>
              <span>{folder === "inbox" ? "From" : "To"}</span>
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
                  ? item.message.attachmentCount ??
                    item.message.attachments?.length ??
                    0
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
                      isInbox
                        ? `To ${item.message.toEmail}`
                        : `From ${item.message.from}`
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
            icon={folder === "sent" ? Send : Inbox}
            title={
              folder === "sent"
                ? accountFilter === "all"
                  ? "No sent emails yet"
                  : `No sent mail for ${accountFilter}`
                : accountFilter === "all"
                  ? "Inbox is empty"
                  : `No mail for ${accountFilter}`
            }
            description={
              folder === "sent"
                ? "Compose an email to start sending from your domain."
                : "Inbound mail routed to your domain will appear here."
            }
            action={
              folder === "sent" ? (
                <Button
                  size="sm"
                  disabled={!relaybaseOk}
                  render={
                    <Link href={composeHref(compose, accountFilter)} />
                  }
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
    </EmailMailboxFrame>
  );
}
