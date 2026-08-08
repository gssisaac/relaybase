"use client";

import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { ComposeForm } from "@/email/components/ComposeForm";
import { useEmailMailboxStore } from "@/email/components/EmailMailboxContext";
import { clearEmailCache } from "@/email/components/email-cached-fetch";
import {
  dispatchEmailSendFailed,
  dispatchEmailSendStarted,
  dispatchEmailSendSucceeded,
} from "@/email/components/email-send-events";
import type { Address, RoutingActivityEvent } from "@/email/components/types";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { parseEmailListStrict } from "@/lib/email/parse-recipients";
import { useEmailPaths } from "@/email/paths";
import { buildReplyPrefill, domainOf } from "@/email/reply-helpers";

const AUTOSAVE_MS = 500;

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
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const store = useEmailMailboxStore();

  const existing = store.findDraftByReplyKey(event.key);
  const prefill = buildReplyPrefill(event, addresses, {
    replyAll,
    fromAccount: accountFilter,
  });

  const [draftId] = useState(
    () => existing?.id ?? crypto.randomUUID(),
  );
  const [sendFrom, setSendFrom] = useState(
    () => existing?.from || prefill.from,
  );
  const [sendTo, setSendTo] = useState(() => existing?.to || prefill.to);
  const [sendCc, setSendCc] = useState(() => {
    if (existing) {
      // Switching Reply ↔ Reply all remounts; refresh Cc from mode
      return replyAll ? prefill.cc : (existing.cc ?? "");
    }
    return prefill.cc;
  });
  const [sendSubject, setSendSubject] = useState(
    () => existing?.subject || prefill.subject,
  );
  const [sendText, setSendText] = useState(
    () => existing?.body ?? prefill.body,
  );
  const [sending, setSending] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string | null>(
    existing ? "Draft saved" : null,
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);
  const latestRef = useRef({
    draftId,
    sendFrom,
    sendTo,
    sendCc,
    sendSubject,
    sendText,
    replyAll,
  });

  useEffect(() => {
    latestRef.current = {
      draftId,
      sendFrom,
      sendTo,
      sendCc,
      sendSubject,
      sendText,
      replyAll,
    };
  }, [draftId, replyAll, sendCc, sendFrom, sendSubject, sendText, sendTo]);

  function flushDraft() {
    if (closedRef.current) return;
    const snap = latestRef.current;
    store.upsertDraft({
      id: snap.draftId,
      from: snap.sendFrom,
      to: snap.sendTo,
      cc: snap.sendCc || undefined,
      subject: snap.sendSubject,
      body: snap.sendText,
      replyKey: event.key,
      replyAll: snap.replyAll,
    });
    setDraftStatus("Draft saved");
  }

  useEffect(() => {
    setDraftStatus(existing ? "Draft saved" : "Saving…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      flushDraft();
    }, AUTOSAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate field-driven autosave
  }, [sendFrom, sendTo, sendCc, sendSubject, sendText]);

  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      flushDraft();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.key]);

  function discard() {
    closedRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    store.removeDraft(draftId);
    onClose();
  }

  function sendEmail() {
    const toParsed = parseEmailListStrict(sendTo);
    const ccParsed = parseEmailListStrict(sendCc);
    const invalid = [...toParsed.invalid, ...ccParsed.invalid];

    if (!sendFrom) {
      store.setError("Choose a From account");
      return;
    }
    if (!toParsed.emails.length) {
      store.setError("Add at least one valid To address");
      return;
    }
    if (invalid.length) {
      store.setError(`Invalid email address: ${invalid.join(", ")}`);
      return;
    }

    setSending(true);
    store.setError(null);

    const payload = {
      from: sendFrom,
      to:
        toParsed.emails.length === 1
          ? toParsed.emails[0]
          : toParsed.emails,
      cc: ccParsed.emails.length
        ? ccParsed.emails.length === 1
          ? ccParsed.emails[0]
          : ccParsed.emails
        : undefined,
      subject: sendSubject,
      text: sendText,
      inReplyTo: prefill.inReplyTo,
      references: prefill.references,
    };
    const domainKey = domainOf(sendFrom) || "none";

    closedRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    store.removeDraft(draftId);
    dispatchEmailSendStarted();

    void (async () => {
      try {
        const res = await fetch(`${apiBase}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Send failed");
        clearEmailCache(productId, `sent:${domainKey}`);
        dispatchEmailSendSucceeded();
        onClose();
      } catch (e) {
        closedRef.current = false;
        dispatchEmailSendFailed(
          e instanceof Error ? e.message : "Send failed",
        );
        setSending(false);
      }
    })();
  }

  // Keep from in sync if account filter changes and draft has no from yet
  useEffect(() => {
    if (sendFrom) return;
    if (prefill.from) setSendFrom(prefill.from);
  }, [prefill.from, sendFrom]);

  return (
    <div className="mt-6 border-t border-border/30 pt-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        {replyAll ? "Reply all" : "Reply"}
      </p>
      <ComposeForm
        sendFrom={sendFrom}
        setSendFrom={setSendFrom}
        addresses={addresses}
        sendTo={sendTo}
        setSendTo={setSendTo}
        sendCc={sendCc}
        setSendCc={setSendCc}
        sendSubject={sendSubject}
        setSendSubject={setSendSubject}
        sendText={sendText}
        setSendText={setSendText}
        sending={sending}
        onSend={sendEmail}
        draftStatus={draftStatus}
        onDiscard={discard}
        allowFromSelect={
          !sendFrom || !addresses.some((a) => a.email === sendFrom)
        }
        compact
      />
    </div>
  );
});
