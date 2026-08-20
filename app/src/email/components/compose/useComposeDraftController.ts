"use client";

import { useEffect, useRef, useState } from "react";

import { clearEmailCache } from "@/email/components/mailbox/email-cached-fetch";
import { scheduleEmailSend } from "@/email/components/compose/email-pending-send";
import {
  dispatchEmailSendFailed,
  dispatchEmailSendSucceeded,
  dispatchEmailSendUndone,
} from "@/email/components/compose/email-send-events";
import type { Address, SentEmail } from "@/email/components/mailbox/types";
import { domainOf } from "@/email/lib/reply/reply-helpers";
import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api-base";
import { parseEmailListStrict } from "@/lib/email/parse-recipients";

const AUTOSAVE_MS = 500;

export type ComposeDraftFields = {
  from: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
};

export type ComposeDraftThreading = {
  inReplyTo?: string;
  references?: string;
};

export type ComposeDraftMode =
  | {
      kind: "standalone";
      draftId?: string | null;
      threading?: ComposeDraftThreading;
      /** When set, persist this forward draft against an inbox message. */
      forwardKey?: string;
    }
  | {
      kind: "reply";
      draftId: string;
      replyKey: string;
      replyAll: boolean;
      threading?: ComposeDraftThreading;
    };

type DraftStore = {
  upsertDraft: (input: {
    id: string;
    from: string;
    to: string;
    cc?: string;
    subject: string;
    body: string;
    replyKey?: string;
    replyAll?: boolean;
    forwardKey?: string;
  }) => unknown;
  removeDraft: (id: string) => void;
  findDraftByReplyKey?: (replyKey: string) => { id: string } | null;
  setError: (value: string | null) => void;
};

export function hasDraftContent(fields: {
  to: string;
  cc: string;
  subject: string;
  body: string;
}) {
  return Boolean(
    fields.to.trim() ||
      fields.cc.trim() ||
      fields.subject.trim() ||
      fields.body.trim(),
  );
}

export type UseComposeDraftControllerInput = {
  store: DraftStore;
  apiBase: string;
  productId: string;
  addresses: Address[];
  mode: ComposeDraftMode;
  initial: ComposeDraftFields;
  /** Ordered From fallbacks when current From is invalid. */
  fromFallbacks?: string[];
  /** Standalone compose skips saving empty drafts. */
  skipAutosaveWhenEmpty?: boolean;
  /**
   * @deprecated Ignored — send always closes immediately for the Unsend window.
   */
  navigateOnSendStart?: boolean;
  onAfterDiscard: () => void;
  onAfterSend: (ctx: { from: string }) => void;
};

export function useComposeDraftController({
  store,
  apiBase,
  productId,
  addresses,
  mode,
  initial,
  fromFallbacks = [],
  skipAutosaveWhenEmpty = false,
  navigateOnSendStart: _navigateOnSendStart = false,
  onAfterDiscard,
  onAfterSend,
}: UseComposeDraftControllerInput) {
  void _navigateOnSendStart;
  const initialDraftId =
    mode.kind === "reply"
      ? mode.draftId
      : (mode.draftId ?? null);

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [sendFrom, setSendFrom] = useState(initial.from);
  const [sendTo, setSendTo] = useState(initial.to);
  const [sendCc, setSendCc] = useState(initial.cc);
  const [sendSubject, setSendSubject] = useState(initial.subject);
  const [sendText, setSendText] = useState(initial.body);
  const [sending, setSending] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string | null>(
    initialDraftId ? "Draft saved" : null,
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);
  const modeRef = useRef(mode);
  const latestRef = useRef({
    draftId,
    sendFrom,
    sendTo,
    sendCc,
    sendSubject,
    sendText,
  });
  const onAfterDiscardRef = useRef(onAfterDiscard);
  const onAfterSendRef = useRef(onAfterSend);
  const prevPreferredFromRef = useRef<string | null | undefined>(undefined);

  // Keep refs in sync during render so Esc/unmount flush never sees a stale snapshot.
  modeRef.current = mode;
  onAfterDiscardRef.current = onAfterDiscard;
  onAfterSendRef.current = onAfterSend;
  latestRef.current = {
    draftId,
    sendFrom,
    sendTo,
    sendCc,
    sendSubject,
    sendText,
  };

  // Resolve From from draft / fallbacks only — never invent a From from
  // addresses[0]. When no account is selected (All inboxes), leave From
  // empty so the user must pick one (mistake prevention).
  // When the preferred account changes (e.g. sidebar Compose account),
  // apply it even if the current From is still a valid address.
  const preferredFrom =
    fromFallbacks.find(
      (email) =>
        Boolean(email) && addresses.some((a) => a.email === email),
    ) ?? null;

  useEffect(() => {
    if (addresses.length === 0) return;
    const isValid = (email: string) =>
      Boolean(email) && addresses.some((a) => a.email === email);

    const prevPreferred = prevPreferredFromRef.current;
    prevPreferredFromRef.current = preferredFrom;
    if (
      preferredFrom &&
      prevPreferred !== undefined &&
      preferredFrom !== prevPreferred
    ) {
      setSendFrom(preferredFrom);
      return;
    }

    if (isValid(sendFrom)) return;
    if (preferredFrom) {
      setSendFrom(preferredFrom);
      return;
    }
    if (sendFrom) setSendFrom("");
  }, [addresses, preferredFrom, sendFrom]);

  function flushDraft() {
    if (closedRef.current) return;
    const snap = latestRef.current;
    const currentMode = modeRef.current;

    if (
      skipAutosaveWhenEmpty &&
      !hasDraftContent({
        to: snap.sendTo,
        cc: snap.sendCc,
        subject: snap.sendSubject,
        body: snap.sendText,
      })
    ) {
      return;
    }

    const id =
      snap.draftId ??
      (currentMode.kind === "reply"
        ? currentMode.draftId
        : crypto.randomUUID());
    if (!snap.draftId) {
      latestRef.current.draftId = id;
      setDraftId(id);
    }

    store.upsertDraft({
      id,
      from: snap.sendFrom,
      to: snap.sendTo,
      cc: snap.sendCc || undefined,
      subject: snap.sendSubject,
      body: snap.sendText,
      ...(currentMode.kind === "reply"
        ? {
            replyKey: currentMode.replyKey,
            replyAll: currentMode.replyAll,
          }
        : currentMode.forwardKey
          ? { forwardKey: currentMode.forwardKey }
          : {}),
    });
    setDraftStatus("Draft saved");
  }

  /** Sync save before Esc/back so resume (`c`) sees this draft as latest. */
  function flushNow() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    flushDraft();
  }

  useEffect(() => {
    if (
      skipAutosaveWhenEmpty &&
      !hasDraftContent({
        to: sendTo,
        cc: sendCc,
        subject: sendSubject,
        body: sendText,
      })
    ) {
      return;
    }
    setDraftStatus((prev) =>
      prev === "Draft saved" ? "Saving…" : (prev ?? "Saving…"),
    );
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      flushDraft();
    }, AUTOSAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- field-driven autosave
  }, [sendCc, sendFrom, sendSubject, sendText, sendTo, skipAutosaveWhenEmpty]);

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
  }, []);

  function discard() {
    closedRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    // Prefer latestRef — autosave may have assigned an id before React re-rendered.
    const id =
      latestRef.current.draftId ??
      draftId ??
      (modeRef.current.kind === "reply" ? modeRef.current.draftId : null);
    // Only remove this draft — sibling reply/forward drafts for the same
    // thread key must remain (Gmail-style multiple drafts).
    if (id) store.removeDraft(id);
    latestRef.current.draftId = null;
    setDraftId(null);
    setSendTo("");
    setSendCc("");
    setSendSubject("");
    setSendText("");
    setDraftStatus(null);
    onAfterDiscardRef.current();
  }

  function send() {
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

    const currentMode = modeRef.current;
    const threading = currentMode.threading;
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
      inReplyTo: threading?.inReplyTo,
      references: threading?.references,
      ...(currentMode.kind === "reply" && currentMode.replyKey
        ? { replyKey: currentMode.replyKey }
        : {}),
    };
    const domainKey = domainOf(sendFrom) || "none";
    const from = sendFrom;

    const restoreDraftId =
      draftId ??
      (currentMode.kind === "reply" ? currentMode.draftId : crypto.randomUUID());
    const restoreDraft = {
      id: restoreDraftId,
      from: sendFrom,
      to: sendTo,
      cc: sendCc || undefined,
      subject: sendSubject,
      body: sendText,
      ...(currentMode.kind === "reply"
        ? {
            replyKey: currentMode.replyKey,
            replyAll: currentMode.replyAll,
          }
        : currentMode.forwardKey
          ? { forwardKey: currentMode.forwardKey }
          : {}),
    };

    closedRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (draftId) store.removeDraft(draftId);
    // Close composer immediately; actual network send waits for Unsend window.
    onAfterSendRef.current({ from });

    scheduleEmailSend({
      onUnsend: () => {
        store.upsertDraft(restoreDraft);
        dispatchEmailSendUndone({
          draftId: restoreDraftId,
          from,
          replyKey:
            currentMode.kind === "reply" ? currentMode.replyKey : undefined,
          replyAll:
            currentMode.kind === "reply" ? currentMode.replyAll : undefined,
        });
      },
      execute: async () => {
        // Unsend toast already covered the waiting UI — skip "Sending…" loading.
        let sendFailedDispatched = false;
        try {
          const res = await desktopAwareFetch(`${apiBase}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await readResponseJson<{
            error?: string;
            code?: string;
            messageId?: string;
            sent?: SentEmail & { bodyPreview?: string };
          }>(res);
          if (!res.ok) {
            dispatchEmailSendFailed({
              error: data.error ?? "Send failed",
              code: data.code,
            });
            sendFailedDispatched = true;
            throw new Error(data.error ?? "Send failed");
          }
          clearEmailCache(productId, `sent:${domainKey}`);
          const sent = data.sent;
          dispatchEmailSendSucceeded(
            sent?.id
              ? {
                  sent: {
                    ...sent,
                    bodyPreview: sent.bodyPreview ?? "",
                  },
                }
              : undefined,
          );
        } catch (e) {
          // Keep the message — restore draft so the user can retry.
          store.upsertDraft(restoreDraft);
          if (!sendFailedDispatched) {
            dispatchEmailSendFailed({
              error: e instanceof Error ? e.message : "Send failed",
            });
          }
          dispatchEmailSendUndone({
            draftId: restoreDraftId,
            from,
            replyKey:
              currentMode.kind === "reply" ? currentMode.replyKey : undefined,
            replyAll:
              currentMode.kind === "reply" ? currentMode.replyAll : undefined,
          });
        }
      },
    });
  }

  return {
    draftId,
    sendFrom,
    setSendFrom,
    sendTo,
    setSendTo,
    sendCc,
    setSendCc,
    sendSubject,
    setSendSubject,
    sendText,
    setSendText,
    sending,
    draftStatus,
    discard,
    send,
    flushNow,
    hasContent: hasDraftContent({
      to: sendTo,
      cc: sendCc,
      subject: sendSubject,
      body: sendText,
    }),
  };
}
