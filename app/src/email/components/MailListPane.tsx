"use client";

import { FilePen, Inbox, Send, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmailCommandContextMenu,
  type EmailCommandRuntime,
} from "@/email/commands";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/EmailListShell";
import {
  formatDate,
  itemKey,
  messageHref,
  previewText,
} from "@/email/components/mail-list-helpers";
import type { MailListItem } from "@/email/components/types";
import {
  threadUnreadKeys,
  type ConversationThread,
} from "@/email/conversation-threading";
import { trimQuotedHistoryForThread } from "@/email/reply-quote-body";
import { formatSenderDisplay } from "@/lib/email/format-sender";
import { extractFirstEmail, SenderAvatar } from "@/email/components/SenderAvatar";

type MailListFolder = "inbox" | "drafts" | "sent" | "trash";

export type MailListPaneProps = {
  folder: MailListFolder;
  items: MailListItem[];
  messageId?: string;
  search: string;
  onSearchChange: (value: string) => void;
  folderBase: string;
  accountFilter: string;
  threadByInboundKey: Map<string, ConversationThread>;
  composeNewHref: string;
  relaybaseOk: boolean;
  emptyTrash: () => void;
  isUnread: (key: string) => boolean;
  commandRuntimeFor: (item: MailListItem) => EmailCommandRuntime;
};

export function MailListPane({
  folder,
  items,
  messageId,
  search,
  onSearchChange,
  folderBase,
  accountFilter,
  threadByInboundKey,
  composeNewHref,
  relaybaseOk,
  emptyTrash,
  isUnread,
  commandRuntimeFor,
}: MailListPaneProps) {
  return (
    <EmailListContainer plain>
      <div className="flex flex-1 flex-col overflow-hidden">
        <ListToolbar
          search={search}
          onSearchChange={onSearchChange}
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
                <span className="size-7 shrink-0" aria-hidden />
                <span>
                  {folder === "sent" || folder === "drafts"
                    ? "To"
                    : folder === "trash"
                      ? "From / To"
                      : "From"}
                </span>
              </span>
              <span>Subject</span>
              <span>Date</span>
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
                        avatar={
                          <SenderAvatar
                            fromEmail={extractFirstEmail(item.message.to)}
                          />
                        }
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
                  ? (thread?.participantLabel ??
                    formatSenderDisplay(
                      item.message.fromName,
                      item.message.fromEmail,
                    ))
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
                      ? threadUnreadKeys(thread, isUnread).length > 0
                      : isUnread(item.message.key)
                    : false;
                const stackCount =
                  thread && thread.messageCount > 1 ? thread.messageCount : undefined;
                return (
                  <EmailCommandContextMenu
                    key={item.id}
                    runtime={commandRuntimeFor(item)}
                  >
                    <EmailTableRow
                      href={messageHref(folderBase, item, accountFilter)}
                      selected={isSelected}
                      unread={unread}
                      avatar={
                        isInbox ? (
                          <SenderAvatar
                            fromName={item.message.fromName}
                            fromEmail={item.message.fromEmail}
                            unread={unread}
                          />
                        ) : (
                          <SenderAvatar
                            fromEmail={extractFirstEmail(item.message.to)}
                          />
                        )
                      }
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
                  render={<Link href={composeNewHref} />}
                >
                  Compose email
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </EmailListContainer>
  );
}
