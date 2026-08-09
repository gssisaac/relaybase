"use client";

import { observer } from "mobx-react-lite";
import { useLayoutEffect, useMemo, useRef } from "react";

import { ComposeDraftEditor } from "@/email/components/ComposeDraftEditor";
import type { Address } from "@/email/components/types";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import {
  buildForwardPrefillFromParts,
  type ForwardThreadPart,
} from "@/email/reply-helpers";

export const InlineForwardComposer = observer(function InlineForwardComposer({
  parts,
  addresses,
  accountFilter,
  onClose,
}: {
  /** Oldest → focused stack in the thread. */
  parts: ForwardThreadPart[];
  addresses: Address[];
  accountFilter: EmailAccountFilter;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefill = useMemo(
    () =>
      buildForwardPrefillFromParts(parts, addresses, {
        fromAccount: accountFilter,
      }),
    [accountFilter, addresses, parts],
  );

  const initial = useMemo(
    () => ({
      from: prefill.from,
      to: prefill.to,
      cc: prefill.cc,
      subject: prefill.subject,
      body: prefill.body,
    }),
    [prefill],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.scrollIntoView({ behavior: "auto", block: "start" });
  }, []);

  return (
    <div ref={rootRef}>
      <ComposeDraftEditor
        initial={initial}
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
        header={
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Forward
          </p>
        }
      />
    </div>
  );
});
