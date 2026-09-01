"use client";

import { observer } from "mobx-react-lite";
import { useLayoutEffect, useMemo, useRef } from "react";

import { ComposeDraftEditor } from "@/email/components/compose/ComposeDraftEditor";
import { useEmailMailboxStore } from "@/email/components/mailbox/EmailMailboxContext";
import type { Address } from "@/email/components/mailbox/types";
import type { EmailAccountFilter } from "@/email/components/accounts/EmailAccountSelect";
import {
  buildForwardPrefillFromParts,
  type ForwardThreadPart,
} from "@/email/lib/reply/reply-helpers";
import { joinQuotedBody, splitQuotedBody } from "@/email/lib/reply/reply-quote-body";

export const InlineForwardComposer = observer(function InlineForwardComposer({
  parts,
  forwardKey,
  draftId,
  addresses,
  accountFilter,
  onClose,
}: {
  /** Oldest → focused stack in the thread. */
  parts: ForwardThreadPart[];
  /** Inbound key used to associate this forward draft with the thread. */
  forwardKey?: string;
  /** When reopening a saved forward draft from a thread row. */
  draftId?: string | null;
  addresses: Address[];
  accountFilter: EmailAccountFilter;
  onClose: () => void;
}) {
  const store = useEmailMailboxStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const existing = draftId ? store.getDraft(draftId) : null;
  const prefill = useMemo(
    () =>
      buildForwardPrefillFromParts(parts, addresses, {
        fromAccount: accountFilter,
      }),
    [accountFilter, addresses, parts],
  );

  const initial = useMemo(() => {
    if (!existing) {
      return {
        from: prefill.from,
        to: prefill.to,
        cc: prefill.cc,
        subject: prefill.subject,
        body: prefill.body,
        attachments: prefill.attachments ?? [],
      };
    }
    // Keep typed forward text from a draft, but refresh nested quote history.
    const typed = splitQuotedBody(existing.body).reply;
    const { quote } = splitQuotedBody(prefill.body);
    return {
      from: existing.from || prefill.from,
      to: existing.to || prefill.to,
      cc: existing.cc ?? prefill.cc,
      subject: existing.subject || prefill.subject,
      body: joinQuotedBody(typed, quote),
      attachments: existing.attachments ?? prefill.attachments ?? [],
    };
  }, [existing, prefill]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.scrollIntoView({ behavior: "auto", block: "start" });
  }, []);

  return (
    <div ref={rootRef}>
      <ComposeDraftEditor
        draftId={existing?.id ?? draftId}
        initial={initial}
        forwardKey={forwardKey || existing?.forwardKey}
        addresses={addresses}
        allowFromSelect={
          !initial.from || !addresses.some((a) => a.email === initial.from)
        }
        alwaysShowDiscard
        compact
        autoFocusBody
        skipAutosaveWhenEmpty
        onAfterDiscard={onClose}
        onAfterSend={onClose}
        onEscape={onClose}
        header={
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Forward
          </p>
        }
      />
    </div>
  );
});
