"use client";

import { observer } from "mobx-react-lite";
import { useLayoutEffect, useMemo, useRef } from "react";

import { ComposeDraftEditor } from "@/email/components/ComposeDraftEditor";
import { useEmailMailboxStore } from "@/email/components/EmailMailboxContext";
import type { Address, RoutingActivityEvent } from "@/email/components/types";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import { buildReplyPrefill } from "@/email/reply-helpers";

export const InlineReplyComposer = observer(function InlineReplyComposer({
  event,
  replyAll,
  addresses,
  accountFilter,
  onClose,
}: {
  event: RoutingActivityEvent;
  replyAll: boolean;
  addresses: Address[];
  accountFilter: EmailAccountFilter;
  onClose: () => void;
}) {
  const store = useEmailMailboxStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const existing = store.findDraftByReplyKey(event.key);
  const prefill = buildReplyPrefill(event, addresses, {
    replyAll,
    fromAccount: accountFilter,
  });

  const initial = useMemo(
    () => ({
      from: existing?.from || prefill.from,
      to: existing?.to || prefill.to,
      cc: existing
        ? replyAll
          ? prefill.cc
          : (existing.cc ?? "")
        : prefill.cc,
      subject: existing?.subject || prefill.subject,
      body: existing?.body ?? prefill.body,
    }),
    [existing, prefill, replyAll],
  );

  const reply = useMemo(
    () => ({
      replyKey: event.key,
      replyAll,
      threading: {
        inReplyTo: prefill.inReplyTo,
        references: prefill.references,
      },
    }),
    [event.key, prefill.inReplyTo, prefill.references, replyAll],
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
        draftId={existing?.id}
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
        header={
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {replyAll ? "Reply all" : "Reply"}
          </p>
        }
      />
    </div>
  );
});
