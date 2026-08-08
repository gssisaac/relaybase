"use client";

import { Inbox, Send, Trash2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import type { EmailMailboxSection } from "@/email/components/EmailMailboxLayout";
import { useEmailMailboxStore } from "@/email/components/EmailMailboxContext";
import { useMailboxNav } from "@/email/components/MailboxNavContext";
import { InboundEmailDetail } from "@/email/components/EmailShared";
import {
  DetailView,
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/EmailListShell";
import type {
  Address,
  MailListItem,
  RoutingActivityEvent,
} from "@/email/components/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function domainOf(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
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
  folder: Extract<EmailMailboxSection, "inbox" | "sent" | "trash">;
  messageId?: string;
};

export const MailListView = observer(function MailListView({
  folder,
  messageId,
}: MailListViewProps) {
  const productId = useProductId();
  const store = useEmailMailboxStore();
  const { compose, inbox, sent, trash } = useMailboxNav();
  const folderBase =
    folder === "inbox" ? inbox : folder === "sent" ? sent : trash;
  const router = useRouter();
  const searchParams = useSearchParams();

  const activity = store.visibleActivity;
  const sentMessages = store.visibleSent;
  const trashedActivity = store.trashedActivity;
  const trashedSent = store.trashedSent;
  const addresses = store.visibleAddresses;
  const accountFilter = store.accountFilter;
  const loading = store.loading;
  const moveToTrash = store.moveToTrash;
  const restoreFromTrash = store.restoreFromTrash;
  const emptyTrash = store.emptyTrash;
  const relaybaseOk = store.relaybaseOk;

  const [search, setSearch] = useState("");
  const activityDetail = messageId
    ? store.getCachedDetail(messageId)
    : null;
  const detailLoading =
    Boolean(messageId) &&
    store.detailLoadingKey === messageId &&
    !activityDetail;

  useEffect(() => {
    if (folder === "sent" && searchParams.get("sent") === "1") {
      // Background send already set "Sending…" via event; strip the query.
      router.replace(`${sent}${accountQuery(accountFilter)}`);
    }
  }, [accountFilter, folder, router, searchParams, sent]);

  useEffect(() => {
    setSearch("");
  }, [folder, accountFilter]);

  const inboxSource = folder === "trash" ? trashedActivity : activity;
  const sentSource = folder === "trash" ? trashedSent : sentMessages;

  const inboxItems = useMemo(
    () =>
      inboxSource
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
    [accountFilter, inboxSource],
  );

  const sentItems = useMemo(
    () =>
      sentSource
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
    [accountFilter, sentSource],
  );

  const items = useMemo((): MailListItem[] => {
    const q = search.trim().toLowerCase();
    const source =
      folder === "inbox"
        ? inboxItems
        : folder === "sent"
          ? sentItems
          : [...inboxItems, ...sentItems];

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
        (() => {
          const inboxPool =
            folder === "trash" ? trashedActivity : activity;
          const sentPool = folder === "trash" ? trashedSent : sentMessages;
          const inboxHit = inboxPool.find((m) => m.key === messageId);
          if (inboxHit || folder === "inbox") {
            return {
              kind: "inbox" as const,
              id: `inbox:${messageId}`,
              message:
                inboxHit ??
                ({
                  key: messageId,
                  fromEmail: "",
                  toEmail: "",
                  subject: "",
                  status: "",
                  receivedAt: new Date(0).toISOString(),
                } satisfies RoutingActivityEvent),
            } satisfies MailListItem;
          }
          const sentHit = sentPool.find((m) => m.id === messageId);
          return sentHit
            ? ({
                kind: "sent" as const,
                id: `sent:${messageId}`,
                message: sentHit,
              } satisfies MailListItem)
            : null;
        })())
      : null;

  const listHref = `${folderBase}${accountQuery(accountFilter)}`;

  const detailDomain = useMemo(() => {
    if (!messageId || folder === "sent") return "";
    const inboxPool = folder === "trash" ? trashedActivity : activity;
    const listHit = inboxPool.find((m) => m.key === messageId);
    if (folder === "trash" && !listHit) return "";
    return (
      (listHit ? domainOf(listHit.toEmail) : "") ||
      (accountFilter !== "all" ? domainOf(accountFilter) : "")
    );
  }, [accountFilter, activity, folder, messageId, trashedActivity]);

  useEffect(() => {
    if (!messageId || folder === "sent") return;
    if (folder === "trash" && !detailDomain) return;
    void store.loadMessageDetail(messageId, detailDomain);
  }, [detailDomain, folder, messageId, store]);

  function trashActions(kind: "inbox" | "sent", id: string) {
    if (folder === "trash") {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            restoreFromTrash(kind, id);
            router.push(listHref);
          }}
        >
          Restore
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          moveToTrash(kind, id);
          router.push(listHref);
        }}
      >
        <Trash2 className="size-3.5" />
        Trash
      </Button>
    );
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const currentIndex = items.findIndex((item) => {
        const id = item.kind === "inbox" ? item.message.key : item.message.id;
        return id === messageId;
      });

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const nextIndex = currentIndex + 1;
        if (nextIndex < items.length) {
          const nextItem = items[nextIndex];
          router.push(messageHref(folderBase, nextItem, accountFilter));
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          const prevItem = items[prevIndex];
          router.push(messageHref(folderBase, prevItem, accountFilter));
        }
      } else if (e.key === "Escape" || e.key === "u") {
        e.preventDefault();
        router.push(listHref);
      } else if (e.key === "c") {
        e.preventDefault();
        router.push(composeHref(compose, accountFilter));
      } else if (e.key === "r" && selected && folder !== "trash") {
        e.preventDefault();
        if (selected.kind === "inbox" && activityDetail) {
          router.push(
            composeReplyHref(
              compose,
              activityDetail,
              addresses,
              accountFilter,
            ),
          );
        }
      } else if (e.key === "a" && selected && folder !== "trash") {
        e.preventDefault();
        if (selected.kind === "inbox" && activityDetail) {
          router.push(
            composeReplyHref(
              compose,
              activityDetail,
              addresses,
              accountFilter,
              { replyAll: true },
            ),
          );
        }
      } else if (
        (e.key === "Backspace" || e.key === "Delete" || e.key === "e") &&
        selected
      ) {
        e.preventDefault();
        const kind = selected.kind;
        const id =
          selected.kind === "inbox"
            ? selected.message.key
            : selected.message.id;
        if (folder === "trash") {
          restoreFromTrash(kind, id);
        } else {
          moveToTrash(kind, id);
        }

        // Select next item if possible
        const nextIndex =
          currentIndex + 1 < items.length
            ? currentIndex + 1
            : currentIndex - 1;
        if (nextIndex >= 0 && nextIndex < items.length) {
          const nextItem = items[nextIndex];
          router.push(messageHref(folderBase, nextItem, accountFilter));
        } else {
          router.push(listHref);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    items,
    messageId,
    router,
    folderBase,
    accountFilter,
    selected,
    activityDetail,
    compose,
    addresses,
    folder,
    moveToTrash,
    restoreFromTrash,
    listHref,
  ]);

  const renderListPane = () => (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search mail…"
        trailing={
          folder === "trash" && items.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => emptyTrash()}>
              Empty trash
            </Button>
          ) : undefined
        }
      />
      {items.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <EmailTableHeader>
            <span>
              {folder === "sent"
                ? "To"
                : folder === "trash"
                  ? "From / To"
                  : "From"}
            </span>
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
              const isSelected = (isInbox ? item.message.key : item.message.id) === messageId;
              return (
                <EmailTableRow
                  key={item.id}
                  href={messageHref(folderBase, item, accountFilter)}
                  selected={isSelected}
                  primary={
                    folder === "trash"
                      ? `${isInbox ? "In" : "Sent"} · ${primary}`
                      : primary
                  }
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
          icon={folder === "sent" ? Send : folder === "trash" ? Trash2 : Inbox}
          title={
            folder === "sent"
              ? accountFilter === "all"
                ? "No sent emails yet"
                : `No sent mail for ${accountFilter}`
              : folder === "trash"
                ? accountFilter === "all"
                  ? "Trash is empty"
                  : `No trash for ${accountFilter}`
                : accountFilter === "all"
                  ? "Inbox is empty"
                  : `No mail for ${accountFilter}`
          }
          description={
            folder === "sent"
              ? "Compose an email to start sending from your domain."
              : folder === "trash"
                ? "Deleted mail from Inbox and Sent appears here. You can restore it."
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
    </div>
  );

  const renderDetailPane = () => {
    if (!selected) {
      return (
        <DetailView title="Message not found" backHref={listHref}>
          <p className="text-sm text-muted-foreground">
            This email could not be loaded.
          </p>
        </DetailView>
      );
    }

    if (selected.kind === "sent") {
      const m = selected.message;
      return (
        <DetailView
          title={m.subject || "(no subject)"}
          backHref={listHref}
          actions={trashActions("sent", m.id)}
        >
          <div className="mb-6 space-y-1 border-b border-border/30 pb-4">
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
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {m.bodyPreview}
          </pre>
        </DetailView>
      );
    }

    if (detailLoading && !activityDetail) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      );
    }

    if (activityDetail) {
      return (
        <DetailView
          title={activityDetail.subject || "(no subject)"}
          backHref={listHref}
          actions={
            <div className="flex items-center gap-2">
              {folder !== "trash" ? (
                <>
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
                </>
              ) : null}
              {trashActions("inbox", activityDetail.key)}
            </div>
          }
        >
          <div className="mb-6 space-y-1 border-b border-border/30 pb-4">
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
              domain={domainOf(activityDetail.toEmail)}
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
      );
    }

    return (
      <DetailView title="Message not found" backHref={listHref}>
        <p className="text-sm text-muted-foreground">
          This email could not be loaded.
        </p>
      </DetailView>
    );
  };

  return (
    <EmailListContainer plain>
      <div className="flex h-full w-full min-w-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden",
            messageId
              ? "hidden shrink-0 border-r border-border/30 md:flex md:w-[360px] lg:w-[400px]"
              : "flex flex-1",
          )}
        >
          {renderListPane()}
        </div>

        {messageId ? (
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-card/40">
            {renderDetailPane()}
          </div>
        ) : null}
      </div>
    </EmailListContainer>
  );
});
