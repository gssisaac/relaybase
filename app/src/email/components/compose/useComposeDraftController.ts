"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clearEmailCache } from "@/email/components/mailbox/email-cached-fetch";
import { scheduleEmailSend } from "@/email/components/compose/email-pending-send";
import {
  dispatchEmailSendFailed,
  dispatchEmailSendSucceeded,
  dispatchEmailSendUndone,
} from "@/email/components/compose/email-send-events";
import type { Address, DraftAttachment, SentEmail } from "@/email/components/mailbox/types";
import {
  deleteDraftAttachmentBytes,
  deleteDraftAttachmentsDir,
  loadDraftAttachmentBytes,
} from "@/email/lib/attachments/draft-attachment-store";
import {
  ingestFilesAsAttachments,
  ingestTransferAsAttachments,
  removeDraftAttachment,
  renameDraftAttachment,
} from "@/email/lib/attachments/ingest-attachment";
import { isImageContentType } from "@/email/lib/attachments/image-optimize";
import { stagedSizeError } from "@/email/lib/attachments/limits";
import {
  buildSendAttachmentPayloads,
  cleanupLocalAttachmentBytes,
} from "@/email/lib/attachments/send-attachments";
import { domainOf } from "@/email/lib/reply/reply-helpers";
import { recordComposeContacts } from "@/email/lib/compose/compose-contacts";
import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api";
import { parseEmailListStrict } from "@/lib/email/parse-recipients";

const AUTOSAVE_MS = 500;

export type ComposeDraftFields = {
  from: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  attachments?: DraftAttachment[];
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
    attachments?: DraftAttachment[];
    replyKey?: string;
    replyAll?: boolean;
    forwardKey?: string;
  }) => unknown;
  removeDraft: (id: string, opts?: { keepAttachmentBytes?: boolean }) => void;
  findDraftByReplyKey?: (replyKey: string) => { id: string } | null;
  setError: (value: string | null) => void;
};

export function hasDraftContent(fields: {
  to: string;
  cc: string;
  subject: string;
  body: string;
  attachments?: DraftAttachment[];
}) {
  return Boolean(
    fields.to.trim() ||
      fields.cc.trim() ||
      fields.subject.trim() ||
      fields.body.trim() ||
      (fields.attachments?.length ?? 0) > 0,
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
  const [attachments, setAttachments] = useState<DraftAttachment[]>(
    initial.attachments ?? [],
  );
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string | null>>(
    {},
  );
  const [sending, setSending] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string | null>(
    initialDraftId ? "Draft saved" : null,
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);
  const modeRef = useRef(mode);
  const previewUrlsRef = useRef<Record<string, string>>({});
  const latestRef = useRef({
    draftId,
    sendFrom,
    sendTo,
    sendCc,
    sendSubject,
    sendText,
    attachments,
  });
  const onAfterDiscardRef = useRef(onAfterDiscard);
  const onAfterSendRef = useRef(onAfterSend);
  const prevPreferredFromRef = useRef<string | null | undefined>(undefined);

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
    attachments,
  };

  const ensureDraftId = useCallback((): string => {
    const snap = latestRef.current;
    const currentMode = modeRef.current;
    if (snap.draftId) return snap.draftId;
    const id =
      currentMode.kind === "reply"
        ? currentMode.draftId
        : crypto.randomUUID();
    latestRef.current.draftId = id;
    setDraftId(id);
    return id;
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    const revoke = { ...previewUrlsRef.current };
    previewUrlsRef.current = {};

    void (async () => {
      const next: Record<string, string | null> = {};
      const id =
        latestRef.current.draftId ?? draftId ?? ensureDraftId();
      for (const item of attachments) {
        if (!isImageContentType(item.contentType)) {
          next[item.id] = null;
          continue;
        }
        if (item.origin === "local") {
          const bytes = await loadDraftAttachmentBytes(productId, id, item.id);
          if (cancelled) return;
          if (bytes) {
            const url = URL.createObjectURL(
              new Blob([bytes], { type: item.contentType }),
            );
            previewUrlsRef.current[item.id] = url;
            next[item.id] = url;
          } else {
            next[item.id] = null;
          }
          continue;
        }
        if (item.source) {
          const params = new URLSearchParams({ domain: item.source.domain });
          const path =
            item.source.kind === "inbound"
              ? `${apiBase}/inbox/${encodeURIComponent(item.source.messageId)}/attachments/${encodeURIComponent(item.source.attachmentId)}?${params}`
              : `${apiBase}/sent/${encodeURIComponent(item.source.messageId)}/attachments/${encodeURIComponent(item.source.attachmentId)}?${params}`;
          next[item.id] = path;
        }
      }
      if (!cancelled) setPreviewUrls(next);
    })();

    return () => {
      cancelled = true;
      for (const url of Object.values(revoke)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [apiBase, attachments, draftId, ensureDraftId, productId]);

  function resolveActiveDraftId(): string {
    const currentMode = modeRef.current;
    return (
      latestRef.current.draftId ??
      draftId ??
      (currentMode.kind === "reply" ? currentMode.draftId : null) ??
      crypto.randomUUID()
    );
  }

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
        attachments: snap.attachments,
      })
    ) {
      return;
    }

    const id = ensureDraftId();

    store.upsertDraft({
      id,
      from: snap.sendFrom,
      to: snap.sendTo,
      cc: snap.sendCc || undefined,
      subject: snap.sendSubject,
      body: snap.sendText,
      attachments: snap.attachments.length ? snap.attachments : undefined,
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
        attachments,
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
  }, [attachments, sendCc, sendFrom, sendSubject, sendText, sendTo, skipAutosaveWhenEmpty]);

  useEffect(() => {
    const sizeErr = stagedSizeError(
      attachments,
      new TextEncoder().encode(sendText).byteLength,
    );
    setAttachmentError(sizeErr);
  }, [attachments, sendText]);

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

  const addFiles = useCallback(
    async (files: File[]) => {
      const id = ensureDraftId();
      const bodyBytes = new TextEncoder().encode(latestRef.current.sendText)
        .byteLength;
      const result = await ingestFilesAsAttachments(
        files,
        latestRef.current.attachments,
        productId,
        id,
        bodyBytes,
      );
      if (!result.ok) {
        setAttachmentError(result.error);
        return;
      }
      setAttachmentError(null);
      setAttachments(result.attachments);
      latestRef.current.attachments = result.attachments;
    },
    [ensureDraftId, productId],
  );

  const addFromTransfer = useCallback(
    async (data: DataTransfer | null) => {
      const id = ensureDraftId();
      const bodyBytes = new TextEncoder().encode(latestRef.current.sendText)
        .byteLength;
      const result = await ingestTransferAsAttachments(
        data,
        latestRef.current.attachments,
        productId,
        id,
        bodyBytes,
      );
      if (!result.ok) {
        setAttachmentError(result.error);
        return;
      }
      setAttachmentError(null);
      setAttachments(result.attachments);
      latestRef.current.attachments = result.attachments;
    },
    [ensureDraftId, productId],
  );

  const removeAttachment = useCallback(
    (attachmentId: string) => {
      const id = latestRef.current.draftId ?? draftId;
      const item = latestRef.current.attachments.find(
        (a) => a.id === attachmentId,
      );
      const next = removeDraftAttachment(
        latestRef.current.attachments,
        attachmentId,
      );
      setAttachments(next);
      latestRef.current.attachments = next;
      if (item?.origin === "local" && id) {
        void deleteDraftAttachmentBytes(productId, id, attachmentId);
      }
    },
    [draftId, productId],
  );

  const renameAttachment = useCallback((attachmentId: string, filename: string) => {
    const next = renameDraftAttachment(
      latestRef.current.attachments,
      attachmentId,
      filename,
    );
    setAttachments(next);
    latestRef.current.attachments = next;
  }, []);

  function discard() {
    closedRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const id =
      latestRef.current.draftId ??
      draftId ??
      (modeRef.current.kind === "reply" ? modeRef.current.draftId : null);
    if (id) store.removeDraft(id);
    latestRef.current.draftId = null;
    setDraftId(null);
    setSendTo("");
    setSendCc("");
    setSendSubject("");
    setSendText("");
    setAttachments([]);
    latestRef.current.attachments = [];
    setAttachmentError(null);
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

    recordComposeContacts(productId, [
      ...toParsed.emails.map((email) => ({ email })),
      ...ccParsed.emails.map((email) => ({ email })),
    ]);

    const sizeErr = stagedSizeError(
      attachments,
      new TextEncoder().encode(sendText).byteLength,
    );
    if (sizeErr) {
      setAttachmentError(sizeErr);
      store.setError(sizeErr);
      return;
    }

    setSending(true);
    store.setError(null);

    // Persist draft + attachment metadata under the same id used for local bytes.
    flushNow();

    const currentMode = modeRef.current;
    const threading = currentMode.threading;
    const domainKey = domainOf(sendFrom) || "none";
    const from = sendFrom;

    const restoreDraftId = resolveActiveDraftId();
    const restoreDraft = {
      id: restoreDraftId,
      from: sendFrom,
      to: sendTo,
      cc: sendCc || undefined,
      subject: sendSubject,
      body: sendText,
      attachments: attachments.length ? attachments : undefined,
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
    if (restoreDraftId) {
      store.removeDraft(restoreDraftId, { keepAttachmentBytes: true });
    }
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
        let sendFailedDispatched = false;
        try {
          const sendAttachments = await buildSendAttachmentPayloads(
            attachments,
            productId,
            restoreDraftId,
          );
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
            ...(sendAttachments.length
              ? { attachments: sendAttachments }
              : {}),
            ...(currentMode.kind === "reply" && currentMode.replyKey
              ? { replyKey: currentMode.replyKey }
              : {}),
          };

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
          await cleanupLocalAttachmentBytes(
            attachments,
            productId,
            restoreDraftId,
          );
          void deleteDraftAttachmentsDir(productId, restoreDraftId);
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
    attachments,
    previewUrls,
    attachmentError,
    addFiles,
    addFromTransfer,
    removeAttachment,
    renameAttachment,
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
      attachments,
    }),
  };
}
