"use client";

import { ArrowLeft, FilePen, Inbox, Send, Trash2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmailCommandContextMenu,
  useEmailCommandRuntimeAdapter,
} from "@/email/commands";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import { ComposeDraftEditor } from "@/email/components/ComposeDraftEditor";
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
import {
  ConversationThreadView,
  type ThreadComposeMode,
} from "@/email/components/ConversationThreadView";
import { InboundEmailDetail } from "@/email/components/EmailShared";
import {
  EMAIL_SEND_UNDONE,
  type EmailSendUndoneDetail,
} from "@/email/components/email-send-events";
import { InlineReplyComposer } from "@/email/components/InlineReplyComposer";
import { useMailboxNav } from "@/email/components/MailboxNavContext";
import type { MailListItem, RoutingActivityEvent } from "@/email/components/types";
import {
  filterSentForAccount,
  findThreadByInboundKey,
  groupConversations,
  inboundMatchesAccount,
  threadMatchesAccount,
  threadMatchesSearch,
  threadUnreadKeys,
  type ConversationThread,
} from "@/email/conversation-threading";
import { trimQuotedHistoryForThread } from "@/email/reply-quote-body";
import { buildReplyPrefill } from "@/email/reply-helpers";
import { emailMessageHref } from "@/email/paths";
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
  // Drafts: sort by first creation so autosave doesn't reshuffle the list.
  return item.message.createdAt;
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
    return inboundMatchesAccount(item.message, needle);
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
  _compose?: string,
  _inbox?: string,
) {
  if (item.kind === "draft") {
    return emailMessageHref(folderBase, item.message.id, { account });
  }
  const id = item.kind === "inbox" ? item.message.key : item.message.id;
  return emailMessageHref(folderBase, id, { account });
}

function threadingFromParent(event: RoutingActivityEvent | null | undefined) {
  if (!event) return undefined;
  const prefill = buildReplyPrefill(event, [], { replyAll: false });
  return {
    inReplyTo: prefill.inReplyTo,
    references: prefill.references,
  };
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
  folder: Extract<EmailMailboxSection, "inbox" | "drafts" | "sent" | "trash">;
  messageId?: string;
};

export const MailListView = observer(function MailListView({
  folder,
  messageId,
}: MailListViewProps) {
  const productId = useProductId();
  const store = useEmailMailboxStore();
  const { compose, inbox, drafts: draftsNav, sent, trash } = useMailboxNav();
  const folderBase =
    folder === "inbox"
      ? inbox
      : folder === "drafts"
        ? draftsNav
        : folder === "sent"
          ? sent
          : trash;
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
  const [composeMode, setComposeMode] = useState<ThreadComposeMode>(null);
  const [composeSourceId, setComposeSourceId] = useState<string | null>(null);
  /** Concrete draft open in the inline composer (new UUID or existing id). */
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  /** After Discard, do not auto-reopen a reply when revisiting this thread. */
  const composeDismissedThreadRef = useRef<string | null>(null);

  const activityDetail = messageId
    ? store.getCachedDetail(messageId)
    : null;
  const detailLoading =
    Boolean(messageId) &&
    messageId != null &&
    store.isDetailLoading(messageId) &&
    !activityDetail;
  useEffect(() => {
    if (folder === "sent" && searchParams.get("sent") === "1") {
      router.replace(`${sent}${accountQuery(accountFilter)}`);
    }
  }, [accountFilter, folder, router, searchParams, sent]);

  useEffect(() => {
    setSearch("");
  }, [folder, accountFilter]);

  const inboxSource = folder === "trash" ? trashedActivity : activity;
  const sentSource = folder === "trash" ? trashedSent : sentMessages;

  /** Inbox conversations (inbound + matching sent). Trash stays flat. */
  const inboxThreads = useMemo((): ConversationThread[] => {
    if (folder !== "inbox") return [];
    const sentForThreading = filterSentForAccount(sentMessages, accountFilter);
    const threads = groupConversations(activity, sentForThreading);
    return threads.filter((thread) => {
      if (accountFilter !== "all" && !threadMatchesAccount(thread, accountFilter)) {
        return false;
      }
      return threadMatchesSearch(thread, search);
    });
  }, [accountFilter, activity, folder, search, sentMessages]);

  const threadByInboundKey = useMemo(() => {
    const map = new Map<string, ConversationThread>();
    for (const thread of inboxThreads) {
      for (const key of thread.inboundKeys) {
        map.set(key, thread);
      }
    }
    return map;
  }, [inboxThreads]);

  const threadInboundKeysFor = useCallback(
    (inboxKey: string) => {
      const thread = threadByInboundKey.get(inboxKey.trim());
      return thread?.inboundKeys ?? [inboxKey.trim()].filter(Boolean);
    },
    [threadByInboundKey],
  );

  const inboxItems = useMemo(() => {
    if (folder === "inbox") {
      return inboxThreads.flatMap((thread) => {
        const latest =
          thread.messages.find(
            (m): m is Extract<typeof m, { kind: "inbound" }> =>
              m.kind === "inbound" && m.id === thread.latestInboundKey,
          )?.message ??
          activity.find((m) => m.key === thread.latestInboundKey);
        if (!latest) return [];
        return [
          {
            kind: "inbox" as const,
            id: `inbox:${thread.latestInboundKey}`,
            message: latest,
          },
        ];
      });
    }
    return inboxSource
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
      }));
  }, [accountFilter, activity, folder, inboxSource, inboxThreads]);

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
      folder === "drafts"
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
    if (folder === "inbox") {
      // Already filtered/sorted by groupConversations + thread filters.
      return inboxItems;
    }
    const source: MailListItem[] =
      folder === "drafts"
        ? draftItems
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

  const selectedThread = useMemo(() => {
    if (folder !== "inbox" || !messageId) return null;
    return (
      threadByInboundKey.get(messageId) ??
      findThreadByInboundKey(inboxThreads, messageId)
    );
  }, [folder, inboxThreads, messageId, threadByInboundKey]);

  const closeCompose = useCallback(() => {
    const threadKey = selectedThread?.threadId ?? messageId;
    if (threadKey) composeDismissedThreadRef.current = threadKey;
    setComposeSourceId(null);
    setComposeDraftId(null);
    setComposeMode(null);
  }, [messageId, selectedThread?.threadId]);

  const openCompose = useCallback(
    (
      mode: Exclude<ThreadComposeMode, null>,
      sourceId?: string | null,
      /** Omit to start a new draft; pass an id to reopen a specific draft. */
      draftId?: string | null,
    ) => {
      composeDismissedThreadRef.current = null;
      setComposeSourceId(sourceId ?? null);
      setComposeDraftId(draftId ?? crypto.randomUUID());
      setComposeMode(mode);
    },
    [],
  );

  // Unsend restores the draft then navigates with ?reply=1 — also reopen here so
  // same-route searchParam updates always restore the reply editor (not just body).
  useEffect(() => {
    const onUndone = (event: Event) => {
      const detail = (event as CustomEvent<EmailSendUndoneDetail>).detail;
      if (!detail?.replyKey) return;
      if (folder !== "inbox") return;
      openCompose(
        detail.replyAll ? "replyAll" : "reply",
        `inbound:${detail.replyKey}`,
        detail.draftId,
      );
    };
    window.addEventListener(EMAIL_SEND_UNDONE, onUndone);
    return () => window.removeEventListener(EMAIL_SEND_UNDONE, onUndone);
  }, [folder, openCompose]);

  const wantsReplyParam = searchParams.get("reply");
  const wantsReplyAllParam = searchParams.get("replyAll");
  const wantsDraftIdParam = searchParams.get("draftId");

  // When opening a message: restore reply panel from ?reply= / ?draftId= query
  useEffect(() => {
    if (folder !== "inbox" || !messageId) {
      setComposeSourceId(null);
      setComposeDraftId(null);
      setComposeMode(null);
      return;
    }
    const threadKey = selectedThread?.threadId ?? messageId;
    const wantsReply = wantsReplyParam === "1";
    const wantsReplyAll = wantsReplyAllParam === "1";
    if (wantsReply || wantsReplyAll) {
      // URL messageId is the reply target (Unsend navigates to draft.replyKey).
      composeDismissedThreadRef.current = null;
      setComposeSourceId(`inbound:${messageId}`);
      setComposeDraftId(wantsDraftIdParam?.trim() || crypto.randomUUID());
      setComposeMode(wantsReplyAll ? "replyAll" : "reply");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("reply");
      params.delete("replyAll");
      params.delete("draftId");
      params.set("m", messageId);
      router.replace(`${inbox}?${params.toString()}`);
      return;
    }
    // Draft reply/forward rows render in ConversationThreadView — do not
    // auto-open the composer when a thread merely has saved drafts.
    if (composeDismissedThreadRef.current === threadKey) {
      setComposeSourceId(null);
      setComposeDraftId(null);
      setComposeMode(null);
      return;
    }
    setComposeSourceId(null);
    setComposeDraftId(null);
    setComposeMode(null);
    // Re-run on message change or Unsend navigation (?reply= / ?replyAll=).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    folder,
    messageId,
    selectedThread?.threadId,
    wantsReplyParam,
    wantsReplyAllParam,
    wantsDraftIdParam,
  ]);

  const selected =
    messageId != null
      ? (folder === "drafts"
          ? (() => {
              const draft =
                store.getDraft(messageId) ??
                items.find(
                  (item): item is Extract<MailListItem, { kind: "draft" }> =>
                    item.kind === "draft" && item.message.id === messageId,
                )?.message;
              return draft
                ? ({
                    kind: "draft" as const,
                    id: `draft:${draft.id}`,
                    message: draft,
                  } satisfies MailListItem)
                : null;
            })()
          : folder === "inbox" && selectedThread
            ? (() => {
                const fromActivity = activity.find(
                  (m) => m.key === selectedThread.latestInboundKey,
                );
                const fromThread = selectedThread.messages.find(
                  (
                    m,
                  ): m is Extract<
                    (typeof selectedThread.messages)[number],
                    { kind: "inbound" }
                  > =>
                    m.kind === "inbound" &&
                    m.id === selectedThread.latestInboundKey,
                )?.message;
                const latest = fromActivity ?? fromThread;
                if (!latest) return null;
                return {
                  kind: "inbox" as const,
                  id: `inbox:${selectedThread.latestInboundKey}`,
                  message: latest,
                } satisfies MailListItem;
              })()
            : (items.find((item) => itemKey(item) === messageId) ??
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
              })()))
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
    threadInboundKeysFor,
    markRead: store.markRead,
    markUnread: store.markUnread,
    markReadMany: store.markReadMany,
    markUnreadMany: store.markUnreadMany,
    moveToTrash,
    moveInboxToTrashMany: store.moveInboxToTrashMany,
    restoreFromTrash,
  });

  const detailDomain = useMemo(() => {
    if (!messageId || folder === "sent" || folder === "drafts") return "";
    // Thread view loads its own details; only need a domain for fallback single-message.
    if (folder === "inbox" && selectedThread) return "";
    const inboxPool = folder === "trash" ? trashedActivity : activity;
    const listHit = inboxPool.find((m) => m.key === messageId);
    if (folder === "trash" && !listHit) return "";
    return (
      (listHit ? domainOf(listHit.toEmail) : "") ||
      (accountFilter !== "all" ? domainOf(accountFilter) : "")
    );
  }, [
    accountFilter,
    activity,
    folder,
    messageId,
    selectedThread,
    trashedActivity,
  ]);

  useEffect(() => {
    if (!messageId || folder === "sent" || folder === "drafts") return;
    if (folder === "inbox" && selectedThread) return;
    if (folder === "trash" && !detailDomain) return;
    void store.loadMessageDetail(messageId, detailDomain);
  }, [detailDomain, folder, messageId, selectedThread, store]);

  function trashActions(kind: "inbox" | "sent", id: string) {
    if (folder === "trash") {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (kind === "inbox") {
              for (const key of threadInboundKeysFor(id)) {
                restoreFromTrash("inbox", key);
              }
            } else {
              restoreFromTrash(kind, id);
            }
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
          if (kind === "inbox" && folder === "inbox") {
            store.moveInboxToTrashMany(threadInboundKeysFor(id));
          } else {
            moveToTrash(kind, id);
          }
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
        if (
          folder === "inbox" &&
          item.kind === "inbox" &&
          messageId
        ) {
          const thread = threadByInboundKey.get(item.message.key);
          if (thread) return thread.inboundKeys.includes(messageId);
        }
        return itemKey(item) === messageId;
      });

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const nextIndex = currentIndex + 1;
        if (nextIndex < items.length) {
          const nextItem = items[nextIndex];
          router.push(
            messageHref(folderBase, nextItem, accountFilter, compose, inbox),
          );
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          const prevItem = items[prevIndex];
          router.push(
            messageHref(folderBase, prevItem, accountFilter, compose, inbox),
          );
        }
      } else if (e.key === "Escape" || e.key === "u") {
        e.preventDefault();
        if (composeMode) {
          closeCompose();
          return;
        }
        router.push(listHref);
      } else if (e.key === "c") {
        e.preventDefault();
        runSelectedCommand("compose");
      } else if (e.key === "r") {
        e.preventDefault();
        if (folder === "inbox" && selectedThread) {
          openCompose(
            "reply",
            `inbound:${selectedThread.latestInboundKey}`,
          );
          return;
        }
        runSelectedCommand("reply");
      } else if (e.key === "a") {
        e.preventDefault();
        if (folder === "inbox" && selectedThread) {
          openCompose(
            "replyAll",
            `inbound:${selectedThread.latestInboundKey}`,
          );
          return;
        }
        runSelectedCommand("replyAll");
      } else if (e.key === "f") {
        e.preventDefault();
        if (folder === "inbox" && selectedThread) {
          openCompose(
            "forward",
            `inbound:${selectedThread.latestInboundKey}`,
          );
          return;
        }
        runSelectedCommand("forward");
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
        } else if (kind === "inbox" && folder === "inbox") {
          store.moveInboxToTrashMany(threadInboundKeysFor(id));
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
            messageHref(folderBase, nextItem, accountFilter, compose, inbox),
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
    inbox,
    folder,
    moveToTrash,
    restoreFromTrash,
    listHref,
    composeMode,
    closeCompose,
    openCompose,
    selectedThread,
    runSelectedCommand,
    paletteOpen,
    store,
    threadByInboundKey,
    threadInboundKeysFor,
  ]);

  const onDraftDiscard = useCallback(() => {
    router.push(listHref);
  }, [listHref, router]);

  const onDraftSend = useCallback(
    ({ from }: { from: string }) => {
      const sentParams = new URLSearchParams({ sent: "1" });
      sentParams.set("account", from);
      router.push(`${sent}?${sentParams.toString()}`);
    },
    [router, sent],
  );

  const replyParentEvent = useMemo(() => {
    if (selected?.kind !== "draft" || !selected.message.replyKey) return null;
    const key = selected.message.replyKey;
    return (
      store.getCachedDetail(key) ??
      activity.find((m) => m.key === key) ??
      trashedActivity.find((m) => m.key === key) ??
      null
    );
  }, [activity, selected, store, trashedActivity]);

  useEffect(() => {
    if (folder !== "drafts" || selected?.kind !== "draft") return;
    const replyKey = selected.message.replyKey;
    if (!replyKey || replyParentEvent?.messageId) return;
    const parent =
      activity.find((m) => m.key === replyKey) ??
      trashedActivity.find((m) => m.key === replyKey);
    const domain =
      (parent ? domainOf(parent.toEmail) : "") ||
      (selected.message.from ? domainOf(selected.message.from) : "") ||
      (accountFilter !== "all" ? domainOf(accountFilter) : "");
    if (!domain) return;
    void store.loadMessageDetail(replyKey, domain);
  }, [
    accountFilter,
    activity,
    folder,
    replyParentEvent?.messageId,
    selected,
    store,
    trashedActivity,
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
                {folder === "sent" || folder === "drafts"
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
                const isSelected = item.message.id === messageId;
                return (
                  <EmailCommandContextMenu
                    key={item.id}
                    runtime={commandRuntimeFor(item)}
                  >
                    <EmailTableRow
                      href={messageHref(folderBase, item, accountFilter)}
                      selected={isSelected}
                      primary={primary}
                      subject={subject}
                      preview={preview}
                      date={date}
                      status={
                        item.message.replyKey ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Reply
                          </Badge>
                        ) : item.message.forwardKey ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Forward
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Draft
                          </Badge>
                        )
                      }
                    />
                  </EmailCommandContextMenu>
                );
              }

              const isInbox = item.kind === "inbox";
              const thread =
                isInbox && folder === "inbox"
                  ? threadByInboundKey.get(item.message.key)
                  : null;
              const primary = isInbox
                ? (thread?.participantLabel ?? item.message.fromEmail)
                : item.message.to;
              const subject = thread?.subject ?? item.message.subject;
              const attachmentCount = isInbox
                ? item.message.attachmentCount ??
                  item.message.attachments?.length ??
                  0
                : 0;
              const date = formatDate(
                thread?.latestAt ??
                  (isInbox ? item.message.receivedAt : item.message.sentAt),
              );
              const previewRaw = thread?.preview || previewText(item);
              const preview = trimQuotedHistoryForThread({
                bodyText: previewRaw,
              }).bodyText.replace(/\s+/g, " ").trim();
              const isSelected =
                isInbox && folder === "inbox" && thread && messageId
                  ? thread.inboundKeys.includes(messageId)
                  : itemKey(item) === messageId;
              const unread =
                isInbox && folder === "inbox"
                  ? thread
                    ? threadUnreadKeys(thread, store.isUnread).length > 0
                    : store.isUnread(item.message.key)
                  : false;
              const stackCount =
                thread && thread.messageCount > 1
                  ? thread.messageCount
                  : undefined;
              return (
                <EmailCommandContextMenu
                  key={item.id}
                  runtime={commandRuntimeFor(item)}
                >
                  <EmailTableRow
                    href={messageHref(folderBase, item, accountFilter)}
                    selected={isSelected}
                    unread={unread}
                    primary={
                      folder === "trash"
                        ? `${isInbox ? "In" : "Sent"} · ${primary}`
                        : primary
                    }
                    subject={subject || "(no subject)"}
                    stackCount={stackCount}
                    subjectAddon={
                      attachmentCount > 0 ? ` (${attachmentCount})` : undefined
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
          icon={
            folder === "sent"
              ? Send
              : folder === "trash"
                ? Trash2
                : folder === "drafts"
                  ? FilePen
                  : Inbox
          }
          title={
            folder === "sent"
              ? accountFilter === "all"
                ? "No sent emails yet"
                : `No sent mail for ${accountFilter}`
              : folder === "trash"
                ? accountFilter === "all"
                  ? "Trash is empty"
                  : `No trash for ${accountFilter}`
                : folder === "drafts"
                  ? accountFilter === "all"
                    ? "No drafts"
                    : `No drafts for ${accountFilter}`
                  : accountFilter === "all"
                    ? "Inbox is empty"
                    : `No mail for ${accountFilter}`
          }
          description={
            folder === "sent"
              ? "Compose an email to start sending from your domain."
              : folder === "trash"
                ? "Deleted mail from Inbox and Sent appears here. You can restore it."
                : folder === "drafts"
                  ? "Unsent messages you save will appear here."
                  : "Inbound mail routed to your domain will appear here."
          }
          action={
            folder === "sent" || folder === "drafts" ? (
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
        <DetailView
          title={folder === "drafts" ? "Draft not found" : "Message not found"}
          backHref={listHref}
        >
          <p className="text-sm text-muted-foreground">
            {folder === "drafts"
              ? "This draft could not be loaded."
              : "This email could not be loaded."}
          </p>
        </DetailView>
      );
    }

    if (selected.kind === "draft") {
      const draft = selected.message;
      const fromSpecified = Boolean(
        draft.from && addresses.some((a) => a.email === draft.from),
      );
      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-border/30 px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              nativeButton={false}
              render={<Link href={listHref} />}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
              {draft.subject || "(no subject)"}
            </h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <ComposeDraftEditor
              key={draft.id}
              draftId={draft.id}
              initial={{
                from: draft.from,
                to: draft.to,
                cc: draft.cc ?? "",
                subject: draft.subject,
                body: draft.body,
              }}
              reply={
                draft.replyKey
                  ? {
                      replyKey: draft.replyKey,
                      replyAll: Boolean(draft.replyAll),
                      threading: threadingFromParent(replyParentEvent),
                    }
                  : undefined
              }
              addresses={addresses}
              fromFallbacks={[draft.from]}
              allowFromSelect={!fromSpecified}
              forwardKey={draft.forwardKey}
              skipAutosaveWhenEmpty={!draft.replyKey && !draft.forwardKey}
              navigateOnSendStart
              alwaysShowDiscard
              onAfterDiscard={onDraftDiscard}
              onAfterSend={onDraftSend}
              header={
                draft.replyKey ? (
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    {draft.replyAll ? "Reply all draft" : "Reply draft"}
                  </p>
                ) : draft.forwardKey ? (
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Forward draft
                  </p>
                ) : undefined
              }
            />
          </div>
        </div>
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

    if (folder === "inbox" && selectedThread) {
      return (
        <DetailView
          title={selectedThread.subject || "(no subject)"}
          backHref={listHref}
          actions={trashActions("inbox", selectedThread.latestInboundKey)}
        >
          <ConversationThreadView
            productId={productId}
            thread={selectedThread}
            folder="inbox"
            addresses={addresses}
            accountFilter={accountFilter}
            composeMode={composeMode}
            onComposeModeChange={(mode) => {
              if (mode === null) {
                closeCompose();
                return;
              }
              composeDismissedThreadRef.current = null;
              setComposeMode(mode);
            }}
            composeSourceId={composeSourceId}
            onComposeSourceIdChange={setComposeSourceId}
            composeDraftId={composeDraftId}
            onComposeDraftIdChange={setComposeDraftId}
            onTrashMessage={({ kind, id }) => {
              if (kind === "inbox") {
                const keys = threadInboundKeysFor(id);
                // Deleting the focused message only — not the whole thread.
                moveToTrash("inbox", id);
                const remaining = keys.filter((key) => key !== id);
                if (remaining.length === 0) {
                  router.push(listHref);
                  return;
                }
                if (id === selectedThread.latestInboundKey) {
                  router.push(
                    emailMessageHref(
                      inbox,
                      remaining[remaining.length - 1]!,
                      { account: accountFilter },
                    ),
                  );
                }
                return;
              }
              moveToTrash("sent", id);
            }}
          />
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
                    onClick={() => openCompose("reply", `inbound:${activityDetail.key}`)}
                  >
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      openCompose("replyAll", `inbound:${activityDetail.key}`)
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
          {folder !== "trash" &&
          (composeMode === "reply" || composeMode === "replyAll") &&
          composeDraftId ? (
            <InlineReplyComposer
              key={`reply:${composeDraftId}:${composeMode}`}
              parts={[{ kind: "inbound", event: activityDetail }]}
              draftReplyKey={activityDetail.key}
              draftId={composeDraftId}
              replyAll={composeMode === "replyAll"}
              addresses={addresses}
              accountFilter={accountFilter}
              onClose={closeCompose}
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
