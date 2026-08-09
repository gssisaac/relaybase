"use client";

import { useEffect, useRef, useState } from "react";

import { clearEmailCache } from "@/email/components/email-cached-fetch";
import {
  dispatchEmailSendFailed,
  dispatchEmailSendStarted,
  dispatchEmailSendSucceeded,
} from "@/email/components/email-send-events";
import type { Address } from "@/email/components/types";
import { domainOf } from "@/email/reply-helpers";
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
   * When true (compose page), call onAfterSend before the fetch completes.
   * When false (inline reply), call onAfterSend only after success.
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
  navigateOnSendStart = false,
  onAfterDiscard,
  onAfterSend,
}: UseComposeDraftControllerInput) {
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

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    onAfterDiscardRef.current = onAfterDiscard;
    onAfterSendRef.current = onAfterSend;
  }, [onAfterDiscard, onAfterSend]);

  useEffect(() => {
    latestRef.current = {
      draftId,
      sendFrom,
      sendTo,
      sendCc,
      sendSubject,
      sendText,
    };
  }, [draftId, sendCc, sendFrom, sendSubject, sendText, sendTo]);

  // Resolve From from draft / fallbacks / first account.
  useEffect(() => {
    if (addresses.length === 0) return;
    const isValid = (email: string) =>
      Boolean(email) && addresses.some((a) => a.email === email);

    if (isValid(sendFrom)) return;

    for (const candidate of fromFallbacks) {
      if (isValid(candidate)) {
        setSendFrom(candidate);
        return;
      }
    }
    setSendFrom(addresses[0]?.email ?? "");
  }, [addresses, fromFallbacks, sendFrom]);

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
        : {}),
    });
    setDraftStatus("Draft saved");
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
    if (id) store.removeDraft(id);
    const replyKey =
      modeRef.current.kind === "reply" ? modeRef.current.replyKey : null;
    if (replyKey) {
      const orphan = store.findDraftByReplyKey?.(replyKey);
      if (orphan && orphan.id !== id) store.removeDraft(orphan.id);
    }
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

    closedRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (draftId) store.removeDraft(draftId);

    dispatchEmailSendStarted();
    if (navigateOnSendStart) {
      onAfterSendRef.current({ from });
    }

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
        if (!navigateOnSendStart) {
          onAfterSendRef.current({ from });
        }
      } catch (e) {
        dispatchEmailSendFailed(
          e instanceof Error ? e.message : "Send failed",
        );
        if (!navigateOnSendStart) {
          closedRef.current = false;
          setSending(false);
        }
      }
    })();
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
    hasContent: hasDraftContent({
      to: sendTo,
      cc: sendCc,
      subject: sendSubject,
      body: sendText,
    }),
  };
}
