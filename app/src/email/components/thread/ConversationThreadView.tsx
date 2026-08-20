"use client";

import {
  Forward,
  MoreVertical,
  Reply,
  ReplyAll,
  Trash2,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InboundEmailDetail } from "@/email/components/mailbox/EmailShared";
import { InlineForwardComposer } from "@/email/components/reply/InlineForwardComposer";
import { InlineReplyComposer } from "@/email/components/reply/InlineReplyComposer";
import { QuotedReplyBlock } from "@/email/components/reply/QuotedReplyBlock";
import { ThreadDraftRows } from "@/email/components/thread/ThreadDraftRows";
import type {
  Address,
  DraftEmail,
  RoutingActivityEvent,
} from "@/email/components/mailbox/types";
import type { EmailAccountFilter } from "@/email/components/accounts/EmailAccountSelect";
import {
  sentIsMeForAccount,
  type ConversationThread,
  type ThreadMessage,
} from "@/email/lib/threading/conversation-threading";
import { useEmailMailboxStore } from "@/email/components/mailbox/EmailMailboxContext";
import { SenderAvatar, extractFirstEmail } from "@/email/components/sender/SenderAvatar";
import { SenderHoverCard, SenderHoverLabel } from "@/email/components/sender/SenderHoverCard";
import type { ForwardThreadPart } from "@/email/lib/reply/reply-helpers";
import {
  normalizeQuoteForDisplay,
  trimQuotedHistoryForThread,
} from "@/email/lib/reply/reply-quote-body";
import { formatSenderDisplay, splitRecipients } from "@/lib/email/format-sender";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
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

function domainOf(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}

function messageIdentity(msg: ThreadMessage) {
  return msg.kind === "inbound" ? `inbound:${msg.id}` : `sent:${msg.id}`;
}

function fromLabel(msg: ThreadMessage) {
  if (msg.kind === "inbound") {
    return formatSenderDisplay(msg.message.fromName, msg.message.fromEmail);
  }
  return msg.message.from;
}

function snippetFor(msg: ThreadMessage, detail: RoutingActivityEvent | null) {
  if (msg.kind === "sent") {
    const trimmed = trimQuotedHistoryForThread({
      bodyText: msg.message.bodyPreview,
    });
    return trimmed.bodyText.replace(/\s+/g, " ").trim();
  }
  const source = detail ?? msg.message;
  const trimmed = trimQuotedHistoryForThread({
    bodyText: source.bodyText,
    bodyPreview: source.bodyPreview,
    bodyHtml: source.bodyHtml,
  });
  return trimmed.bodyText.replace(/\s+/g, " ").trim();
}

function latestInboundKey(thread: ConversationThread): string | null {
  for (let i = thread.messages.length - 1; i >= 0; i--) {
    const msg = thread.messages[i]!;
    if (msg.kind === "inbound") return msg.id;
  }
  return null;
}

/** Inbound key used to persist a reply draft when focusing a sent stack item. */
function draftReplyKeyForSent(
  thread: ConversationThread,
  sentId: string,
  sentReplyKey: string | undefined,
): string | null {
  const linked = sentReplyKey?.trim();
  if (linked && thread.inboundKeys.includes(linked)) return linked;
  const idx = thread.messages.findIndex(
    (m) => m.kind === "sent" && m.id === sentId,
  );
  for (let i = idx - 1; i >= 0; i--) {
    const msg = thread.messages[i]!;
    if (msg.kind === "inbound") return msg.id;
  }
  return latestInboundKey(thread);
}

/** Draft replyKey for the focused stack (inbound id, or linked inbound for sent). */
export function draftReplyKeyForThread(
  thread: ConversationThread,
  focusId: string | null,
): string | null {
  const focused = thread.messages.find((m) => messageIdentity(m) === focusId);
  if (focused?.kind === "inbound") return focused.id;
  if (focused?.kind === "sent") {
    return draftReplyKeyForSent(
      thread,
      focused.id,
      focused.message.replyKey,
    );
  }
  return latestInboundKey(thread);
}

/**
 * Thread history through the focused stack (oldest → focused), for reply/forward
 * quotes. Replying at the bottom includes the full conversation above it.
 */
export function forwardPartsForThread(
  thread: ConversationThread,
  focusId: string | null,
  getCachedDetail: (key: string) => RoutingActivityEvent | null,
): ForwardThreadPart[] {
  const focusIndex = focusId
    ? thread.messages.findIndex((m) => messageIdentity(m) === focusId)
    : -1;
  const end =
    focusIndex >= 0
      ? focusIndex + 1
      : Math.max(1, thread.messages.length);
  const slice = thread.messages.slice(0, end);
  return slice.map((msg): ForwardThreadPart => {
    if (msg.kind === "inbound") {
      const cached = getCachedDetail(msg.id);
      // Disk/API detail can omit envelope fields — never drop list addressing.
      const event = cached
        ? {
            ...msg.message,
            ...cached,
            toEmail: cached.toEmail || msg.message.toEmail,
            fromEmail: cached.fromEmail || msg.message.fromEmail,
            subject: cached.subject || msg.message.subject,
          }
        : msg.message;
      return { kind: "inbound", event };
    }
    return { kind: "sent", message: msg.message };
  });
}

export type ThreadComposeMode = "reply" | "replyAll" | "forward" | null;

export const ConversationThreadView = observer(function ConversationThreadView({
  productId,
  thread,
  folder,
  addresses,
  accountFilter,
  composeMode,
  onComposeModeChange,
  composeSourceId,
  onComposeSourceIdChange,
  composeDraftId,
  onComposeDraftIdChange,
  onTrashMessage,
}: {
  productId: string;
  thread: ConversationThread;
  folder: "inbox" | "trash";
  addresses: Address[];
  accountFilter: EmailAccountFilter;
  composeMode: ThreadComposeMode;
  onComposeModeChange: (mode: ThreadComposeMode) => void;
  /** messageIdentity of the stack row that opened compose; locked while open. */
  composeSourceId: string | null;
  onComposeSourceIdChange: (id: string | null) => void;
  /** Draft id currently open in the composer (new UUID or an existing draft). */
  composeDraftId: string | null;
  onComposeDraftIdChange: (id: string | null) => void;
  onTrashMessage: (target: {
    kind: "inbox" | "sent";
    id: string;
  }) => void;
}) {
  const store = useEmailMailboxStore();
  const latestId = messageIdentity(thread.messages[thread.messages.length - 1]!);
  const isSingleMessage = thread.messages.length === 1;
  const [expandedId, setExpandedId] = useState<string | null>(latestId);
  const inboundKey = thread.inboundKeys.join("\0");
  const canAct = folder !== "trash";

  useEffect(() => {
    setExpandedId(latestId);
  }, [thread.threadId, latestId]);

  useEffect(() => {
    store.markReadMany(thread.inboundKeys);
    for (const msg of thread.messages) {
      if (msg.kind !== "inbound") continue;
      const domain =
        domainOf(msg.message.toEmail) ||
        (accountFilter !== "all" ? domainOf(accountFilter) : "");
      void store.loadMessageDetail(msg.id, domain);
    }
  }, [
    accountFilter,
    inboundKey,
    store,
    thread.inboundKeys,
    thread.messages,
    thread.threadId,
  ]);

  const composeFocusId = composeMode
    ? (composeSourceId ?? expandedId)
    : expandedId;
  const quoteParts = useMemo(
    () =>
      composeMode === "reply" ||
      composeMode === "replyAll" ||
      composeMode === "forward"
        ? forwardPartsForThread(thread, composeFocusId, (key) =>
            store.getCachedDetail(key),
          )
        : [],
    [composeFocusId, composeMode, store, thread],
  );
  const draftReplyKey = useMemo(
    () =>
      composeMode === "reply" || composeMode === "replyAll"
        ? draftReplyKeyForThread(thread, composeFocusId)
        : null,
    [composeFocusId, composeMode, thread],
  );
  const draftForwardKey = useMemo(
    () =>
      composeMode === "forward"
        ? draftReplyKeyForThread(thread, composeFocusId)
        : null,
    [composeFocusId, composeMode, thread],
  );

  const threadDrafts = store.findDraftsForThread(thread.inboundKeys);
  const visibleDrafts = useMemo(() => {
    // Only hide the draft currently open in the composer — sibling reply /
    // forward drafts for the same key stay visible as separate rows.
    if (!composeDraftId) return threadDrafts;
    return threadDrafts.filter((draft) => draft.id !== composeDraftId);
  }, [composeDraftId, threadDrafts]);

  // Per-message UI actions always start a new draft — quote stack depends on
  // which message was clicked. Keyboard r/a/f resume is handled in MailListView.
  function startReply(msgId: string, mode: "reply" | "replyAll") {
    onComposeDraftIdChange(crypto.randomUUID());
    setExpandedId(msgId);
    onComposeSourceIdChange(msgId);
    onComposeModeChange(mode);
  }

  function startForward(msgId: string) {
    onComposeDraftIdChange(crypto.randomUUID());
    setExpandedId(msgId);
    onComposeSourceIdChange(msgId);
    onComposeModeChange("forward");
  }

  function closeCompose() {
    onComposeDraftIdChange(null);
    onComposeSourceIdChange(null);
    onComposeModeChange(null);
  }

  function parentForDraft(draft: DraftEmail) {
    const key = (draft.replyKey || draft.forwardKey || "").trim();
    if (!key) return null;
    const msg = thread.messages.find(
      (m) => m.kind === "inbound" && m.id === key,
    );
    if (!msg || msg.kind !== "inbound") return null;
    return { at: msg.at, email: msg.message.fromEmail };
  }

  function openDraft(draft: DraftEmail) {
    if (draft.replyKey) {
      const sourceId = `inbound:${draft.replyKey}`;
      onComposeDraftIdChange(draft.id);
      setExpandedId(sourceId);
      onComposeSourceIdChange(sourceId);
      onComposeModeChange(draft.replyAll ? "replyAll" : "reply");
      return;
    }
    if (draft.forwardKey) {
      const sourceId = `inbound:${draft.forwardKey}`;
      onComposeDraftIdChange(draft.id);
      setExpandedId(sourceId);
      onComposeSourceIdChange(sourceId);
      onComposeModeChange("forward");
    }
  }

  function deleteDraft(draft: DraftEmail) {
    store.removeDraft(draft.id);
    if (composeDraftId === draft.id) closeCompose();
  }

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="divide-y divide-border/30">
        {thread.messages.map((msg) => {
          const id = messageIdentity(msg);
          const expanded = isSingleMessage || expandedId === id;
          const detail =
            msg.kind === "inbound" ? store.getCachedDetail(msg.id) : null;
          const loading =
            msg.kind === "inbound" && store.isDetailLoading(msg.id);
          const from = fromLabel(msg);
          const snippet = snippetFor(msg, detail);
          const at = msg.at;
          const avatarEmail =
            msg.kind === "inbound"
              ? msg.message.fromEmail
              : extractFirstEmail(msg.message.from);
          const avatarName =
            msg.kind === "inbound"
              ? msg.message.fromName
              : splitRecipients(msg.message.from)[0]?.name;
          const meSuffix =
            msg.kind === "sent" && sentIsMeForAccount(from, accountFilter) ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (me)
              </span>
            ) : null;
          const senderLabel = (
            <>
              <SenderHoverLabel fromName={avatarName} fromEmail={avatarEmail}>
                {from}
              </SenderHoverLabel>
              {meSuffix}
            </>
          );

          return (
            <div key={id} className="shrink-0">
              {expanded ? (
                <div className="flex w-full shrink-0 items-start gap-3 px-1 py-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 text-left transition-colors hover:opacity-90"
                    onClick={() => {
                      if (!isSingleMessage) setExpandedId(null);
                    }}
                  >
                    <SenderHoverCard
                      fromName={avatarName}
                      fromEmail={avatarEmail}
                      triggerClassName="size-7"
                    >
                      <SenderAvatar
                        fromName={avatarName}
                        fromEmail={avatarEmail}
                      />
                    </SenderHoverCard>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {senderLabel}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                    <span className="mr-1 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDetailDate(at)}
                    </span>
                    {canAct ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Reply"
                          onClick={() => startReply(id, "reply")}
                        >
                          <Reply />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="More actions"
                              />
                            }
                          >
                            <MoreVertical />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => startReply(id, "reply")}
                            >
                              <Reply />
                              Reply
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => startReply(id, "replyAll")}
                            >
                              <ReplyAll />
                              Reply all
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => startForward(id)}
                            >
                              <Forward />
                              Forward
                            </DropdownMenuItem>
                            <div
                              className="my-1 h-px bg-border"
                              role="separator"
                            />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                onTrashMessage({
                                  kind:
                                    msg.kind === "inbound" ? "inbox" : "sent",
                                  id: msg.id,
                                })
                              }
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full shrink-0 items-start gap-3 px-1 py-3 text-left transition-colors hover:opacity-90"
                  onClick={() => setExpandedId(id)}
                >
                  <SenderHoverCard
                    fromName={avatarName}
                    fromEmail={avatarEmail}
                    triggerClassName="size-7"
                  >
                    <SenderAvatar
                      fromName={avatarName}
                      fromEmail={avatarEmail}
                    />
                  </SenderHoverCard>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {senderLabel}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {snippet || "(no preview)"}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-muted-foreground">
                    {formatDetailDate(at)}
                  </span>
                </button>
              )}

              {expanded ? (
                <div className="flex shrink-0 items-start gap-3 px-1">
                  {/* Match avatar column so body aligns with from-address. */}
                  <span className="size-7 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1 shrink-0 space-y-4 pr-1">
                    {msg.kind === "inbound" ? (
                      <>
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-muted-foreground">To </span>
                            {(
                              (detail ?? msg.message).toEmails?.length
                                ? (detail ?? msg.message).toEmails!
                                : [(detail ?? msg.message).toEmail]
                            ).join(", ")}
                          </p>
                          {((detail ?? msg.message).ccEmails?.length ?? 0) >
                          0 ? (
                            <p>
                              <span className="text-muted-foreground">
                                Cc{" "}
                              </span>
                              {(detail ?? msg.message).ccEmails!.join(", ")}
                            </p>
                          ) : null}
                          {(detail ?? msg.message).errorDetail ? (
                            <p className="pt-1 text-destructive">
                              {(detail ?? msg.message).errorDetail}
                            </p>
                          ) : null}
                        </div>
                        {loading &&
                        !(detail?.bodyText || detail?.bodyHtml) ? (
                          <div className="flex justify-center py-6">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          </div>
                        ) : (
                          (() => {
                            const source = detail ?? msg.message;
                            const trimmed = trimQuotedHistoryForThread({
                              bodyText: source.bodyText,
                              bodyPreview: source.bodyPreview,
                              bodyHtml: source.bodyHtml,
                            });
                            return (
                              <InboundEmailDetail
                                productId={productId}
                                messageKey={msg.id}
                                domain={domainOf(msg.message.toEmail)}
                                bodyText={trimmed.bodyText}
                                bodyHtml={trimmed.bodyHtml}
                                plain
                                quoteText={trimmed.quoteText}
                                attachments={
                                  detail?.attachments ??
                                  msg.message.attachments ??
                                  []
                                }
                              />
                            );
                          })()
                        )}
                      </>
                    ) : (
                      <>
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-muted-foreground">To </span>
                            {msg.message.to}
                          </p>
                          {msg.message.cc ? (
                            <p>
                              <span className="text-muted-foreground">
                                Cc{" "}
                              </span>
                              {msg.message.cc}
                            </p>
                          ) : null}
                        </div>
                        {(() => {
                          const sentTrimmed = trimQuotedHistoryForThread({
                            bodyText: msg.message.bodyPreview,
                          });
                          return (
                            <>
                              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                                {sentTrimmed.bodyText}
                              </pre>
                              {sentTrimmed.quoteText ? (
                                <QuotedReplyBlock
                                  quote={normalizeQuoteForDisplay(
                                    sentTrimmed.quoteText,
                                  )}
                                />
                              ) : null}
                            </>
                          );
                        })()}
                      </>
                    )}
                    {/* Explicit spacer — pb on flex children can be crushed by shrink. */}
                    <div className="h-5 shrink-0" aria-hidden />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {canAct ? (
        <ThreadDraftRows
          drafts={visibleDrafts}
          parentForDraft={parentForDraft}
          onOpen={openDraft}
          onDelete={deleteDraft}
        />
      ) : null}

      {canAct &&
      (composeMode === "reply" || composeMode === "replyAll") &&
      quoteParts.length > 0 &&
      draftReplyKey &&
      composeDraftId ? (
        <InlineReplyComposer
          key={`reply:${composeDraftId}:${composeMode}:${quoteParts.length}`}
          parts={quoteParts}
          draftReplyKey={draftReplyKey}
          draftId={composeDraftId}
          replyAll={composeMode === "replyAll"}
          addresses={addresses}
          accountFilter={accountFilter}
          onClose={closeCompose}
        />
      ) : null}
      {canAct &&
      composeMode === "forward" &&
      quoteParts.length > 0 &&
      draftForwardKey &&
      composeDraftId ? (
        <InlineForwardComposer
          key={`fwd:${composeDraftId}:${composeFocusId ?? "latest"}:${quoteParts.length}`}
          parts={quoteParts}
          forwardKey={draftForwardKey}
          draftId={composeDraftId}
          addresses={addresses}
          accountFilter={accountFilter}
          onClose={closeCompose}
        />
      ) : null}
    </div>
  );
});
