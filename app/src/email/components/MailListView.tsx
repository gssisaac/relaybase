"use client";

import { Inbox, Send, Trash2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmailCommandContextMenu,
  useEmailCommandRuntimeAdapter,
} from "@/email/commands";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import type { EmailMailboxSection } from "@/email/components/EmailMailboxLayout";
import { useEmailMailboxStore } from "@/email/components/EmailMailboxContext";
import {
  DetailView,
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/EmailListShell";
import { InboundEmailDetail } from "@/email/components/EmailShared";
import { InlineReplyComposer } from "@/email/components/InlineReplyComposer";
import { useMailboxNav } from "@/email/components/MailboxNavContext";
import type { MailListItem, RoutingActivityEvent } from "@/email/components/types";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
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

function composeHref(compose: string, fromAccount: EmailAccountFilter) {
  if (fromAccount === "all") return compose;
  return `${compose}?from=${encodeURIComponent(fromAccount)}`;
}

function itemSortAt(item: MailListItem) {
  if (item.kind === "inbox") return item.message.receivedAt;
  if (item.kind === "sent") return item.message.sentAt;
  return item.message.updatedAt;
}

function itemKey(item: MailListItem) {
  if (item.kind === "inbox") return item.message.key;
  return item.message.id;
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
  if (item.kind === "draft") {
    return !item.message.from || item.message.from.toLowerCase() === needle;
  }
  return item.message.from.toLowerCase() === needle;
}

function messageHref(
  folderBase: string,
  item: MailListItem,
  account: EmailAccountFilter,
  compose: string,
) {
  if (item.kind === "draft") {
    if (item.message.replyKey) {
      const path = `${folderBase}/${encodeURIComponent(item.message.replyKey)}`;
      return `${path}${accountQuery(account)}`;
    }
    return `${compose}?draft=${encodeURIComponent(item.message.id)}`;
  }
  const id = item.kind === "inbox" ? item.message.key : item.message.id;
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
  if (item.kind === "draft") {
    return item.message.body.replace(/\s+/g, " ").trim();
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
  const drafts = store.visibleDrafts;
  const trashedActivity = store.trashedActivity;
  const trashedSent = store.trashedSent;
  const addresses = store.visibleAddresses;
  const accountFilter = store.accountFilter;
  const moveToTrash = store.moveToTrash;
  const restoreFromTrash = store.restoreFromTrash;
  const emptyTrash = store.emptyTrash;
  const relaybaseOk = store.relaybaseOk;

  const [search, setSearch] = useState("");
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | null>(
    null,
  );

  const activityDetail = messageId
    ? store.getCachedDetail(messageId)
    : null;
  const detailLoading =
    Boolean(messageId) &&
    store.detailLoadingKey === messageId &&
    !activityDetail;
  useEffect(() => {
    if (folder === "sent" && searchParams.get("sent") === "1") {
      router.replace(`${sent}${accountQuery(accountFilter)}`);
    }
  }, [accountFilter, folder, router, searchParams, sent]);

  useEffect(() => {
    setSearch("");
  }, [folder, accountFilter]);

  // When opening a message: restore reply panel from draft or ?reply= query
  useEffect(() => {
    if (folder !== "inbox" || !messageId) {
      setReplyMode(null);
      return;
    }
    const wantsReply = searchParams.get("reply") === "1";
    const wantsReplyAll = searchParams.get("replyAll") === "1";
    if (wantsReply || wantsReplyAll) {
      setReplyMode(wantsReplyAll ? "replyAll" : "reply");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("reply");
      params.delete("replyAll");
      const qs = params.toString();
      router.replace(
        `${inbox}/${encodeURIComponent(messageId)}${qs ? `?${qs}` : ""}`,
      );
      return;
    }
    const draft = store.findDraftByReplyKey(messageId);
    setReplyMode(
      draft ? (draft.replyAll ? "replyAll" : "reply") : null,
    );
    // Only re-run when the opened message changes — not on every draft upsert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, messageId]);

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

  const draftItems = useMemo(
    () =>
      folder === "inbox"
        ? drafts
            .filter((d) =>
              matchesAccount(
                { kind: "draft", id: `draft:${d.id}`, message: d },
                accountFilter,
              ),
            )
            .map((d) => ({
              kind: "draft" as const,
              id: `draft:${d.id}`,
              message: d,
            }))
        : [],
    [accountFilter, drafts, folder],
  );

  const items = useMemo((): MailListItem[] => {
    const q = search.trim().toLowerCase();
    const source: MailListItem[] =
      folder === "inbox"
        ? [...inboxItems, ...draftItems]
        : folder === "sent"
          ? sentItems
          : [...inboxItems, ...sentItems];

    return source
      .sort(
        (a, b) =>
          new Date(itemSortAt(b)).getTime() - new Date(itemSortAt(a)).getTime(),
      )
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
        if (item.kind === "draft") {
          return (
            item.message.subject.toLowerCase().includes(q) ||
            item.message.to.toLowerCase().includes(q) ||
            item.message.from.toLowerCase().includes(q) ||
            item.message.body.toLowerCase().includes(q)
          );
        }
        return (
          item.message.subject.toLowerCase().includes(q) ||
          item.message.to.toLowerCase().includes(q) ||
          item.message.from.toLowerCase().includes(q) ||
          item.message.bodyPreview.toLowerCase().includes(q)
        );
      });
  }, [draftItems, folder, inboxItems, search, sentItems]);

  const selected =
    messageId != null
      ? (items.find((item) => {
          if (item.kind === "draft") return false;
          return itemKey(item) === messageId;
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

  const {
    commandRuntimeFor,
    runSelectedCommand,
    paletteOpen,
  } = useEmailCommandRuntimeAdapter({
    folder,
    selected,
    accountFilter,
    folderBase,
    compose,
    inbox,
    listHref,
    router,
    isUnread: store.isUnread,
    markRead: store.markRead,
    markUnread: store.markUnread,
    moveToTrash,
    restoreFromTrash,
  });

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
    // Mail keyboard layer (bubble): never compete with app-layer ⌘K / palette.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (paletteOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const currentIndex = items.findIndex((item) => {
        if (item.kind === "draft") {
          return (
            item.message.replyKey === messageId ||
            (!item.message.replyKey && item.message.id === messageId)
          );
        }
        return itemKey(item) === messageId;
      });

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const nextIndex = currentIndex + 1;
        if (nextIndex < items.length) {
          const nextItem = items[nextIndex];
          router.push(
            messageHref(folderBase, nextItem, accountFilter, compose),
          );
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          const prevItem = items[prevIndex];
          router.push(
            messageHref(folderBase, prevItem, accountFilter, compose),
          );
        }
      } else if (e.key === "Escape" || e.key === "u") {
        e.preventDefault();
        if (replyMode) {
          setReplyMode(null);
          return;
        }
        router.push(listHref);
      } else if (e.key === "c") {
        e.preventDefault();
        runSelectedCommand("compose");
      } else if (e.key === "r") {
        e.preventDefault();
        runSelectedCommand("reply");
      } else if (e.key === "a") {
        e.preventDefault();
        runSelectedCommand("replyAll");
      } else if (
        (e.key === "Backspace" || e.key === "Delete" || e.key === "e") &&
        selected &&
        selected.kind !== "draft"
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

        const nextIndex =
          currentIndex + 1 < items.length
            ? currentIndex + 1
            : currentIndex - 1;
        if (nextIndex >= 0 && nextIndex < items.length) {
          const nextItem = items[nextIndex];
          router.push(
            messageHref(folderBase, nextItem, accountFilter, compose),
          );
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
    compose,
    folder,
    moveToTrash,
    restoreFromTrash,
    listHref,
    replyMode,
    runSelectedCommand,
    paletteOpen,
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
            <span className="flex items-center gap-2">
              <span className="size-2 shrink-0" aria-hidden />
              <span>
                {folder === "sent"
                  ? "To"
                  : folder === "trash"
                    ? "From / To"
                    : "From"}
              </span>
            </span>
            <span>Subject</span>
            <span className="text-right">Date</span>
          </EmailTableHeader>
          <div>
            {items.map((item) => {
              if (item.kind === "draft") {
                const primary = item.message.to || "(no recipient)";
                const subject = item.message.subject || "(no subject)";
                const date = formatDate(item.message.updatedAt);
                const preview = previewText(item);
                const isSelected = item.message.replyKey
                  ? item.message.replyKey === messageId
                  : false;
                return (
                  <EmailCommandContextMenu
                    key={item.id}
                    runtime={commandRuntimeFor(item)}
                  >
                    <EmailTableRow
                      href={messageHref(
                        folderBase,
                        item,
                        accountFilter,
                        compose,
                      )}
                      selected={isSelected}
                      primary={primary}
                      subject={subject}
                      preview={preview}
                      date={date}
                      status={
                        <Badge variant="secondary" className="text-[10px]">
                          Draft
                        </Badge>
                      }
                    />
                  </EmailCommandContextMenu>
                );
              }

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
              const isSelected = itemKey(item) === messageId;
              const unread =
                isInbox && folder === "inbox"
                  ? store.isUnread(item.message.key)
                  : false;
              return (
                <EmailCommandContextMenu
                  key={item.id}
                  runtime={commandRuntimeFor(item)}
                >
                  <EmailTableRow
                    href={messageHref(
                      folderBase,
                      item,
                      accountFilter,
                      compose,
                    )}
                    selected={isSelected}
                    unread={unread}
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
                </EmailCommandContextMenu>
              );
            })}
          </div>
        </div>
      ) : (
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

    if (selected.kind === "draft") {
      return null;
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
                    onClick={() => setReplyMode("reply")}
                  >
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReplyMode("replyAll")}
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
          {folder !== "trash" && replyMode ? (
            <InlineReplyComposer
              key={`${activityDetail.key}:${replyMode}`}
              event={activityDetail}
              replyAll={replyMode === "replyAll"}
              addresses={addresses}
              accountFilter={accountFilter}
              onClose={() => setReplyMode(null)}
            />
          ) : null}
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
