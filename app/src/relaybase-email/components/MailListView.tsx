"use client";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { Inbox, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import type { EmailAccountFilter } from "@/relaybase-email/components/EmailAccountSelect";
import type { EmailMailboxSection } from "@/relaybase-email/components/EmailMailboxLayout";
import { useEmailMailbox } from "@/relaybase-email/components/EmailMailboxContext";
import {
  InboundEmailDetail,
} from "@/relaybase-email/components/EmailShared";
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
  MailListItem,
  RoutingActivityEvent,
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

type MailListViewProps = {
  folder: Extract<EmailMailboxSection, "inbox" | "sent">;
};

export function MailListView({ folder }: MailListViewProps) {
  const productId = useProductId();
  const { apiBase, compose, sent } = useEmailPaths();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    activity,
    sent: sentMessages,
    addresses,
    accountFilter,
    loading,
    refresh,
    setMessage,
    setError,
    relaybaseOk,
  } = useEmailMailbox();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityDetail, setActivityDetail] =
    useState<RoutingActivityEvent | null>(null);

  useEffect(() => {
    if (folder === "sent" && searchParams.get("sent") === "1") {
      setMessage("Email sent");
      void refresh(true);
      router.replace(sent);
    }
  }, [folder, refresh, router, searchParams, sent, setMessage]);

  useEffect(() => {
    setSelectedId(null);
    setActivityDetail(null);
    setSearch("");
  }, [folder, accountFilter]);

  const inboxItems = useMemo(
    () =>
      activity
        .filter((m) =>
          matchesAccount(
            { kind: "inbox", id: `inbox:${m.key}`, message: m },
            accountFilter,
          ),
        )
        .map((m) => ({
          kind: "inbox" as const,
          id: `inbox:${m.key}`,
          message: m,
        })),
    [accountFilter, activity],
  );

  const sentItems = useMemo(
    () =>
      sentMessages
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
    [accountFilter, sentMessages],
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

  if (selected) {
    if (selected.kind === "sent") {
      const m = selected.message;
      return (
        <EmailListContainer plain>
            <DetailView title={m.subject} onBack={closeDetail}>
              <p className="mb-4 text-xs text-muted-foreground">
                To {m.to}
                {m.cc ? <> · Cc {m.cc}</> : null} · From {m.from} ·{" "}
                {formatDate(m.sentAt)}
              </p>
              <pre className="whitespace-pre-wrap text-sm">{m.bodyPreview}</pre>
            </DetailView>
          </EmailListContainer>
      );
    }
    if (activityDetail) {
      return (
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
      );
    }
    return (
      <EmailListContainer plain>
          <div className="min-h-0 flex-1" />
        </EmailListContainer>
    );
  }

  return (
    <EmailListContainer plain>
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search mail…"
        />
        {items.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-auto">
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
                    onClick={() => void openItem(item)}
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
          </div>
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
          <div className="min-h-0 flex-1" />
        )}
      </EmailListContainer>
  );
}
