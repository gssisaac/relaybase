"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ComposeDraftEditor } from "@/email/components/ComposeDraftEditor";
import { DetailView } from "@/email/components/EmailListShell";
import { ConversationThreadView } from "@/email/components/ConversationThreadView";
import { InboundEmailDetail } from "@/email/components/EmailShared";
import { InlineReplyComposer } from "@/email/components/InlineReplyComposer";
import {
  domainOf,
  formatDetailDate,
  threadingFromParent,
} from "@/email/components/mail-list-helpers";
import type { MailListItem } from "@/email/components/types";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { emailMessageHref } from "@/email/paths";
import type { ThreadComposeMode } from "@/email/components/ConversationThreadView";
import type { ConversationThread } from "@/email/conversation-threading";
import type { EmailMailboxStore } from "@/email/email-mailbox-store";
import type {
  Address,
  RoutingActivityEvent,
} from "@/email/components/types";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";

export type MailDetailPaneProps = {
  folder: "inbox" | "drafts" | "sent" | "trash";
  selected: MailListItem | null;
  selectedThread: ConversationThread | null;
  messageId?: string;
  activityDetail: RoutingActivityEvent | null;
  detailLoading: boolean;
  addresses: Address[];
  accountFilter: EmailAccountFilter;
  listHref: string;
  inbox: string;
  sent: string;
  productId: string;
  store: EmailMailboxStore;
  composeMode: ThreadComposeMode;
  composeSourceId: string | null;
  setComposeSourceId: (id: string | null) => void;
  composeDraftId: string | null;
  setComposeDraftId: (id: string | null) => void;
  onComposeModeChange: (mode: ThreadComposeMode) => void;
  closeCompose: () => void;
  openCompose: (
    mode: Exclude<ThreadComposeMode, null>,
    sourceId?: string | null,
    draftId?: string | null,
  ) => void;
  threadInboundKeysFor: (key: string) => string[];
  moveToTrash: (kind: "inbox" | "sent", id: string) => void;
  restoreFromTrash: (kind: "inbox" | "sent", id: string) => void;
  onDraftDiscard: () => void;
  onDraftSend: (ctx: { from: string }) => void;
  router: { push: (href: string) => void };
};

export function MailDetailPane({
  folder,
  selected,
  selectedThread,
  messageId,
  activityDetail,
  detailLoading,
  addresses,
  accountFilter,
  listHref,
  inbox,
  sent,
  productId,
  store,
  composeMode,
  composeSourceId,
  setComposeSourceId,
  composeDraftId,
  setComposeDraftId,
  onComposeModeChange,
  closeCompose,
  openCompose,
  threadInboundKeysFor,
  moveToTrash,
  restoreFromTrash,
  onDraftDiscard,
  onDraftSend,
  router,
}: MailDetailPaneProps) {
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
    const replyParentEvent = selected.message.replyKey
      ? (store.getCachedDetail(selected.message.replyKey) ??
        store.activity.find((m) => m.key === selected.message.replyKey) ??
        store.trashedActivity.find((m) => m.key === selected.message.replyKey) ??
        null)
      : null;

    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DesktopTitleBar className="border-b border-border/30 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
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
        </DesktopTitleBar>
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
            onEscape={onDraftDiscard}
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
          onComposeModeChange={onComposeModeChange}
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
}
