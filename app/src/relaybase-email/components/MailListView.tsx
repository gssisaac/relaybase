"use client";

import { Inbox, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import type { EmailAccountFilter } from "@/relaybase-email/components/EmailAccountSelect";
import type { EmailMailboxSection } from "@/relaybase-email/components/EmailMailboxLayout";
import { useEmailMailbox } from "@/relaybase-email/components/EmailMailboxContext";
import { useMailboxNav } from "@/relaybase-email/components/MailboxNavContext";
import { InboundEmailDetail } from "@/relaybase-email/components/EmailShared";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
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
import { Button } from "@/components/ui/button";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Stable formatting (no locale / "today" checks) to avoid SSR hydration mismatches. */
function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? "AM" : "PM";
  return `${months[date.getMonth()]} ${date.getDate()}, ${hour12}:${minutes} ${ampm}`;
}

function formatDetailDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? "AM" : "PM";
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${hour12}:${minutes} ${ampm}`;
}

function accountQuery(account: EmailAccountFilter) {
  if (account === "all") return "";
  return `?account=${encodeURIComponent(account)}`;
}

function composeReplyHref(
  compose: string,
  event: RoutingActivityEvent,
  addresses: Address[],
  fromAccount?: EmailAccountFilter,
  options?: { replyAll?: boolean },
) {
  const defaultFrom =
    fromAccount && fromAccount !== "all"
      ? fromAccount
      : addresses.find((a) => a.email.toLowerCase() === event.toEmail.toLowerCase())
          ?.email ?? addresses[0]?.email;
  const subject = event.subject.startsWith("Re:")
    ? event.subject
    : `Re: ${event.subject}`;
  const params = new URLSearchParams({
    reply: "1",
    replyKey: event.key,
    to: event.fromEmail,
    subject,
  });
  if (options?.replyAll) params.set("replyAll", "1");
  if (defaultFrom) params.set("from", defaultFrom);
  const parentId = event.messageId?.trim();
  if (parentId) {
    params.set("inReplyTo", parentId);
    const prior = event.references?.trim();
    params.set("references", prior ? `${prior} ${parentId}` : parentId);
  }
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

function messageHref(
  folderBase: string,
  item: MailListItem,
  account: EmailAccountFilter,
) {
  const id =
    item.kind === "inbox" ? item.message.key : item.message.id;
  const path = `${folderBase}/${encodeURIComponent(id)}`;
  return `${path}${accountQuery(account)}`;
}

function previewText(item: MailListItem) {
  if (item.kind === "inbox") {
    return (
      item.message.bodyPreview?.replace(/\s+/g, " ").trim() ||
      item.message.bodyText?.replace(/\s+/g, " ").trim() ||
      ""
    );
  }
  return item.message.bodyPreview?.replace(/\s+/g, " ").trim() || "";
}

type MailListViewProps = {
  folder: Extract<EmailMailboxSection, "inbox" | "sent">;
  messageId?: string;
};

export function MailListView({ folder, messageId }: MailListViewProps) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { compose, inbox, sent } = useMailboxNav();
  const folderBase = folder === "inbox" ? inbox : sent;
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    activity,
    sent: sentMessages,
    addresses,
    accountFilter,
    loading,
    setError,
    relaybaseOk,
  } = useEmailMailbox();

  const [search, setSearch] = useState("");
  const [activityDetail, setActivityDetail] =
    useState<RoutingActivityEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (folder === "sent" && searchParams.get("sent") === "1") {
      // Background send already set "Sending…" via event; strip the query.
      router.replace(`${sent}${accountQuery(accountFilter)}`);
    }
  }, [accountFilter, folder, router, searchParams, sent]);

  useEffect(() => {
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
            item.message.toEmail.toLowerCase().includes(q) ||
            (item.message.bodyPreview ?? "").toLowerCase().includes(q)
          );
        }
        return (
          item.message.subject.toLowerCase().includes(q) ||
          item.message.to.toLowerCase().includes(q) ||
          item.message.from.toLowerCase().includes(q) ||
          item.message.bodyPreview.toLowerCase().includes(q)
        );
      });
  }, [folder, inboxItems, search, sentItems]);

  const selected =
    messageId != null
      ? (items.find((item) => {
          const id =
            item.kind === "inbox" ? item.message.key : item.message.id;
          return id === messageId;
        }) ??
        (folder === "inbox"
          ? ({
              kind: "inbox" as const,
              id: `inbox:${messageId}`,
              message:
                activity.find((m) => m.key === messageId) ??
                ({
                  key: messageId,
                  fromEmail: "",
                  toEmail: "",
                  subject: "",
                  status: "",
                  receivedAt: new Date(0).toISOString(),
                } satisfies RoutingActivityEvent),
            } satisfies MailListItem)
          : sentMessages.find((m) => m.id === messageId)
            ? ({
                kind: "sent" as const,
                id: `sent:${messageId}`,
                message: sentMessages.find((m) => m.id === messageId)!,
              } satisfies MailListItem)
            : null))
      : null;

  const listHref = `${folderBase}${accountQuery(accountFilter)}`;

  useEffect(() => {
    if (!messageId || folder !== "inbox") {
      setActivityDetail(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setActivityDetail(null);

    void (async () => {
      try {
        const res = await fetch(
          `${apiBase}/inbox/${encodeURIComponent(messageId)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        if (!cancelled) setActivityDetail(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load event");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBase, folder, messageId, setError]);

  if (selected && messageId) {
    if (selected.kind === "sent") {
      const m = selected.message;
      return (
        <EmailListContainer plain>
          <DetailView title={m.subject || "(no subject)"} backHref={listHref}>
            <div className="mb-6 space-y-1 border-b border-border pb-4">
              <p className="text-sm">
                <span className="text-muted-foreground">To </span>
                {m.to}
              </p>
              {m.cc ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Cc </span>
                  {m.cc}
                </p>
              ) : null}
              <p className="text-sm">
                <span className="text-muted-foreground">From </span>
                {m.from}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDetailDate(m.sentAt)}
              </p>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {m.bodyPreview}
            </pre>
          </DetailView>
        </EmailListContainer>
      );
    }

    if (detailLoading && !activityDetail) {
      return (
        <EmailListContainer plain>
          <div className="min-h-0 flex-1" />
        </EmailListContainer>
      );
    }

    if (activityDetail) {
      return (
        <EmailListContainer plain>
          <DetailView
            title={activityDetail.subject || "(no subject)"}
            backHref={listHref}
            actions={
              <div className="flex items-center gap-2">
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
                        { replyAll: true },
                      )}
                    />
                  }
                >
                  Reply all
                </Button>
              </div>
            }
          >
            <div className="mb-6 space-y-1 border-b border-border pb-4">
              <p className="text-sm">
                <span className="text-muted-foreground">From </span>
                {activityDetail.fromEmail}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">To </span>
                {(activityDetail.toEmails?.length
                  ? activityDetail.toEmails
                  : [activityDetail.toEmail]
                ).join(", ")}
              </p>
              {(activityDetail.ccEmails?.length ?? 0) > 0 ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Cc </span>
                  {activityDetail.ccEmails!.join(", ")}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {formatDetailDate(activityDetail.receivedAt)}
              </p>
              {activityDetail.errorDetail ? (
                <p className="pt-2 text-sm text-destructive">
                  {activityDetail.errorDetail}
                </p>
              ) : null}
            </div>
            {activityDetail.bodyText ||
            activityDetail.bodyHtml ||
            (activityDetail.attachments?.length ?? 0) > 0 ? (
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
            ) : (
              <p className="text-sm text-muted-foreground">
                {activityDetail.bodyPreview ||
                  "No message body available for this email."}
              </p>
            )}
          </DetailView>
        </EmailListContainer>
      );
    }

    return (
      <EmailListContainer plain>
        <DetailView title="Message not found" backHref={listHref}>
          <p className="text-sm text-muted-foreground">
            This email could not be loaded.
          </p>
        </DetailView>
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
            <span>Subject</span>
            <span className="text-right">Date</span>
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
              const preview = previewText(item);
              return (
                <EmailTableRow
                  key={item.id}
                  href={messageHref(folderBase, item, accountFilter)}
                  primary={primary}
                  subject={
                    attachmentCount > 0
                      ? `${subject || "(no subject)"} (${attachmentCount})`
                      : subject
                  }
                  preview={preview}
                  date={date}
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
