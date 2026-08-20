"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { EmailMailboxSection } from "@/email/components/mailbox/EmailMailboxLayout";
import { useEmailMailboxStore } from "@/email/components/mailbox/EmailMailboxContext";
import { useMailboxNav } from "@/email/components/mailbox/MailboxNavContext";
import type { MailListItem, RoutingActivityEvent } from "@/email/components/mailbox/types";
import {
  accountQuery,
  domainOf,
  itemKey,
  itemSortAt,
  matchesAccount,
  messageHref,
} from "./mail-list-helpers";
import {
  filterSentForAccount,
  findThreadByInboundKey,
  groupConversations,
  threadMatchesAccount,
  threadMatchesSearch,
  type ConversationThread,
} from "@/email/lib/threading/conversation-threading";
import { trashEntryKey } from "@/email/lib/trash/trash-store";

type MailListFolder = Extract<
  EmailMailboxSection,
  "inbox" | "drafts" | "sent" | "trash"
>;

export function useMailListItems({
  folder,
  messageId,
  search,
}: {
  folder: MailListFolder;
  messageId?: string;
  search: string;
}) {
  const store = useEmailMailboxStore();
  const { inbox, drafts: draftsNav, sent, trash } = useMailboxNav();
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
  const accountFilter = store.accountFilter;
  const listHref = `${folderBase}${accountQuery(accountFilter)}`;

  const inboxSource = folder === "trash" ? trashedActivity : activity;
  const sentSource = folder === "trash" ? trashedSent : sentMessages;

  /**
   * Server-side search mode: the Worker returns flat matching messages, so
   * list items bypass thread grouping and the local search filter. Falls
   * back to local filtering when the Worker search index is unavailable.
   */
  const serverSearch =
    (folder === "inbox" || folder === "sent") &&
    store.searchActiveFor(folder, search);

  /** Inbox conversations (inbound + matching sent). Trash stays flat. */
  const inboxThreads = useMemo((): ConversationThread[] => {
    if (folder !== "inbox") return [];
    const sentForThreading = filterSentForAccount(sentMessages, accountFilter);
    const threads = groupConversations(activity, sentForThreading);
    return threads.filter((thread) => {
      if (
        accountFilter !== "all" &&
        !threadMatchesAccount(thread, accountFilter)
      ) {
        return false;
      }
      // Server search renders its own flat results; keep every thread here
      // so opening a search hit still lands in its conversation view.
      return serverSearch || threadMatchesSearch(thread, search);
    });
  }, [accountFilter, activity, folder, search, sentMessages, serverSearch]);

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

  const searchInboxResults = store.searchInboxResults;
  const searchSentResults = store.searchSentResults;
  const trashKeys = store.trashKeys;

  /** Flat server search results, filtered by trash + account locally. */
  const searchItems = useMemo((): MailListItem[] => {
    if (!serverSearch) return [];
    if (folder === "inbox") {
      return searchInboxResults
        .filter((m) => !trashKeys.has(trashEntryKey("inbox", m.key)))
        .map((m) => ({
          kind: "inbox" as const,
          id: `inbox:${m.key}`,
          message: m,
        }))
        .filter((item) => matchesAccount(item, accountFilter));
    }
    return searchSentResults
      .filter((m) => !trashKeys.has(trashEntryKey("sent", m.id)))
      .map((m) => ({
        kind: "sent" as const,
        id: `sent:${m.id}`,
        message: m,
      }))
      .filter((item) => matchesAccount(item, accountFilter));
  }, [
    accountFilter,
    folder,
    searchInboxResults,
    searchSentResults,
    serverSearch,
    trashKeys,
  ]);

  const items = useMemo((): MailListItem[] => {
    if (serverSearch) {
      return searchItems;
    }
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

    const sorted = source
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
    return sorted;
  }, [draftItems, folder, inboxItems, search, searchItems, sentItems, serverSearch]);

  const selectedThread = useMemo(() => {
    if (folder !== "inbox" || !messageId) return null;
    return (
      threadByInboundKey.get(messageId) ??
      findThreadByInboundKey(inboxThreads, messageId)
    );
  }, [folder, inboxThreads, messageId, threadByInboundKey]);

  const selected = useMemo((): MailListItem | null => {
    if (messageId == null) return null;
    if (folder === "drafts") {
      const draft =
        store.getDraft(messageId) ??
        items.find(
          (item): item is Extract<MailListItem, { kind: "draft" }> =>
            item.kind === "draft" && item.message.id === messageId,
        )?.message;
      return draft
        ? ({ kind: "draft", id: `draft:${draft.id}`, message: draft } satisfies MailListItem)
        : null;
    }
    if (folder === "inbox" && selectedThread) {
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
    }
    const found = items.find((item) => itemKey(item) === messageId);
    if (found) return found;

    const inboxPool = folder === "trash" ? trashedActivity : activity;
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
  }, [activity, folder, items, messageId, selectedThread, sentMessages, store, trashedActivity, trashedSent]);

  const activityDetail = messageId ? store.getCachedDetail(messageId) : null;
  const detailLoading =
    Boolean(messageId) &&
    messageId != null &&
    store.isDetailLoading(messageId) &&
    !activityDetail;

  const detailDomain = useMemo(() => {
    if (!messageId || folder === "sent" || folder === "drafts") return "";
    // Thread view loads its own details; only need a domain for fallback single-message.
    if (folder === "inbox" && selectedThread) return "";
    const inboxPool = folder === "trash" ? trashedActivity : activity;
    const listHit =
      inboxPool.find((m) => m.key === messageId) ??
      searchInboxResults.find((m) => m.key === messageId);
    if (folder === "trash" && !listHit) return "";
    return (
      (listHit ? domainOf(listHit.toEmail) : "") ||
      (accountFilter !== "all" ? domainOf(accountFilter) : "")
    );
  }, [accountFilter, activity, folder, messageId, searchInboxResults, selectedThread, trashedActivity]);

  useEffect(() => {
    if (!messageId || folder === "sent" || folder === "drafts") return;
    if (folder === "inbox" && selectedThread) return;
    if (folder === "trash" && !detailDomain) return;
    void store.loadMessageDetail(messageId, detailDomain);
  }, [detailDomain, folder, messageId, selectedThread, store]);

  useEffect(() => {
    if (folder === "sent" && searchParams.get("sent") === "1") {
      router.replace(`${sent}${accountQuery(accountFilter)}`);
    }
  }, [accountFilter, folder, router, searchParams, sent]);

  const loadMore = useCallback(() => {
    if (serverSearch) {
      void store.loadMoreSearch();
      return;
    }
    if (folder === "inbox") {
      void store.loadMoreInbox();
      return;
    }
    if (folder === "sent") {
      void store.loadMoreSent();
    }
  }, [folder, serverSearch, store]);

  return {
    store,
    activity,
    sentMessages,
    trashedActivity,
    trashedSent,
    accountFilter,
    listHref,
    folderBase,
    items,
    inboxThreads,
    threadByInboundKey,
    threadInboundKeysFor,
    selected,
    selectedThread,
    activityDetail,
    detailLoading,
    detailDomain,
    serverSearch,
    searchTotal: serverSearch ? store.searchTotal : null,
    searchLoading: serverSearch ? store.searchLoading : false,
    hasMore: serverSearch
      ? store.searchHasMore
      : folder === "inbox"
        ? store.inboxHasMore
        : folder === "sent" && !search.trim()
          ? store.sentHasMore
          : false,
    loadingMore: serverSearch
      ? store.searchLoadingMore
      : folder === "inbox"
        ? store.inboxLoadingMore
        : folder === "sent"
          ? store.sentLoadingMore
          : false,
    loadMore,
  };
}

export type UseMailListItems = ReturnType<typeof useMailListItems>;
