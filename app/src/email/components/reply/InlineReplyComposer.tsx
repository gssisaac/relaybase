"use client";

import { observer } from "mobx-react-lite";
import { useLayoutEffect, useMemo, useRef } from "react";

import { ComposeDraftEditor } from "@/email/components/compose/ComposeDraftEditor";
import { useEmailMailboxStore } from "@/email/components/mailbox/EmailMailboxContext";
import type { Address } from "@/email/components/mailbox/types";
import type { EmailAccountFilter } from "@/email/components/accounts/EmailAccountSelect";
import {
  buildReplyPrefillFromParts,
  type ForwardThreadPart,
} from "@/email/lib/reply/reply-helpers";
import { joinQuotedBody, splitQuotedBody } from "@/email/lib/reply/reply-quote-body";

export const InlineReplyComposer = observer(function InlineReplyComposer({
  parts,
  draftReplyKey,
  draftId,
  replyAll,
  addresses,
  accountFilter,
  onClose,
}: {
  /** Oldest → focused stack — nested quote body (same as forward). */
  parts: ForwardThreadPart[];
  /** Inbound key for draft persistence / send replyKey. */
  draftReplyKey: string;
  /**
   * Concrete draft to edit. When missing from the store this starts a fresh
   * reply under this id (multiple reply drafts per replyKey are allowed).
   */
  draftId: string;
  replyAll: boolean;
  addresses: Address[];
  accountFilter: EmailAccountFilter;
  onClose: () => void;
}) {
  const store = useEmailMailboxStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const existing = store.getDraft(draftId);
  const prefill = useMemo(
    () =>
      buildReplyPrefillFromParts(parts, addresses, {
        replyAll,
        fromAccount: accountFilter,
      }),
    [accountFilter, addresses, parts, replyAll],
  );

  const initial = useMemo(() => {
    // Keep typed reply text from a draft, but always refresh nested quote history.
    const typed = existing
      ? splitQuotedBody(existing.body).reply
      : "";
    const { quote } = splitQuotedBody(prefill.body);
    return {
      from: existing?.from || prefill.from,
      to: existing?.to || prefill.to,
      cc: existing
        ? replyAll
          ? prefill.cc
          : (existing.cc ?? "")
        : prefill.cc,
      subject: existing?.subject || prefill.subject,
      body: joinQuotedBody(typed, quote),
      attachments: existing?.attachments ?? prefill.attachments ?? [],
    };
  }, [existing, prefill, replyAll]);

  const reply = useMemo(
    () => ({
      replyKey: draftReplyKey,
      replyAll,
      threading: {
        inReplyTo: prefill.inReplyTo,
        references: prefill.references,
      },
    }),
    [draftReplyKey, prefill.inReplyTo, prefill.references, replyAll],
  );

  // Jump instantly to the reply box — never smooth-scroll (long threads are slow).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.scrollIntoView({ behavior: "auto", block: "start" });
  }, []);

  return (
    <div ref={rootRef}>
      <ComposeDraftEditor
        draftId={draftId}
        initial={initial}
        reply={reply}
        addresses={addresses}
        allowFromSelect={
          !initial.from || !addresses.some((a) => a.email === initial.from)
        }
        alwaysShowDiscard
        compact
        autoFocusBody
        onAfterDiscard={onClose}
        onAfterSend={onClose}
        onEscape={onClose}
        header={
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {replyAll ? "Reply all" : "Reply"}
          </p>
        }
      />
    </div>
  );
});
