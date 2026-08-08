"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { ComposeForm } from "@/email/components/ComposeForm";
import { useEmailMailbox } from "@/email/components/EmailMailboxContext";
import { clearEmailCache } from "@/email/components/email-cached-fetch";
import {
  dispatchEmailSendFailed,
  dispatchEmailSendStarted,
  dispatchEmailSendSucceeded,
} from "@/email/components/email-send-events";
import { useMailboxNav } from "@/email/components/MailboxNavContext";
import { useEmailPaths } from "@/email/paths";
import { domainOf } from "@/email/reply-helpers";
import { parseEmailListStrict } from "@/lib/email/parse-recipients";

const AUTOSAVE_MS = 500;

function hasDraftContent(fields: {
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

export function ComposeView() {
  const productId = useProductId();
  const { apiBase, inbox } = useEmailPaths();
  const { sent } = useMailboxNav();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReply = searchParams.get("reply") === "1";
  const replyKey = searchParams.get("replyKey")?.trim() || "";
  const draftParam = searchParams.get("draft")?.trim() || "";
  const toParam = searchParams.get("to");
  const ccParam = searchParams.get("cc");
  const subjectParam = searchParams.get("subject");
  const fromParam = searchParams.get("from");
  const inReplyToParam = searchParams.get("inReplyTo");
  const referencesParam = searchParams.get("references");

  const {
    addresses,
    accountFilter,
    setError,
    store,
  } = useEmailMailbox();

  const existingDraft = draftParam ? store.getDraft(draftParam) : null;

  const [draftId, setDraftId] = useState<string | null>(
    () => existingDraft?.id ?? (draftParam || null),
  );
  const [sendFrom, setSendFrom] = useState(() => existingDraft?.from ?? "");
  const [sendTo, setSendTo] = useState(() => existingDraft?.to ?? "");
  const [sendCc, setSendCc] = useState(() => existingDraft?.cc ?? "");
  const [sendSubject, setSendSubject] = useState(
    () => existingDraft?.subject ?? "",
  );
  const [sendText, setSendText] = useState(() => existingDraft?.body ?? "");
  const [sending, setSending] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string | null>(
    existingDraft ? "Draft saved" : null,
  );
  const [hydratedDraftId, setHydratedDraftId] = useState<string | null>(
    existingDraft?.id ?? null,
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
  });

  // Old reply links → inbox message sub-page
  useEffect(() => {
    if (!isReply || !replyKey) return;
    const params = new URLSearchParams();
    if (accountFilter !== "all") {
      params.set("account", accountFilter);
    }
    params.set("reply", "1");
    if (searchParams.get("replyAll") === "1") {
      params.set("replyAll", "1");
    }
    const qs = params.toString();
    router.replace(
      `${inbox}/${encodeURIComponent(replyKey)}${qs ? `?${qs}` : ""}`,
    );
  }, [accountFilter, inbox, isReply, replyKey, router, searchParams]);

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

  useEffect(() => {
    if (existingDraft && hydratedDraftId !== existingDraft.id) {
      setDraftId(existingDraft.id);
      setSendFrom(existingDraft.from);
      setSendTo(existingDraft.to);
      setSendCc(existingDraft.cc ?? "");
      setSendSubject(existingDraft.subject);
      setSendText(existingDraft.body);
      setHydratedDraftId(existingDraft.id);
      setDraftStatus("Draft saved");
    }
  }, [existingDraft, hydratedDraftId]);

  // Prefer draft.from, then URL/sidebar filter, then first account.
  useEffect(() => {
    if (addresses.length === 0) return;
    const isValid = (email: string) =>
      Boolean(email) && addresses.some((a) => a.email === email);

    if (isValid(sendFrom)) return;
    // Draft list still loading from disk
    if (draftParam && !existingDraft) return;

    if (existingDraft && isValid(existingDraft.from)) {
      setSendFrom(existingDraft.from);
      return;
    }
    const fromQuery = fromParam?.trim() || "";
    if (isValid(fromQuery)) {
      setSendFrom(fromQuery);
      return;
    }
    if (accountFilter !== "all" && isValid(accountFilter)) {
      setSendFrom(accountFilter);
      return;
    }
    setSendFrom(addresses[0]?.email ?? "");
  }, [
    accountFilter,
    addresses,
    draftParam,
    existingDraft,
    fromParam,
    sendFrom,
  ]);

  useEffect(() => {
    if (existingDraft) return;
    const toQuery = toParam?.trim();
    if (toQuery) setSendTo(toQuery);
    const ccQuery = ccParam?.trim();
    if (ccQuery) setSendCc(ccQuery);
    const subjectQuery = subjectParam?.trim();
    if (subjectQuery) setSendSubject(subjectQuery);
  }, [ccParam, existingDraft, subjectParam, toParam]);

  function flushDraft() {
    if (closedRef.current) return;
    const snap = latestRef.current;
    if (
      !hasDraftContent({
        to: snap.sendTo,
        cc: snap.sendCc,
        subject: snap.sendSubject,
        body: snap.sendText,
      })
    ) {
      return;
    }
    const id = snap.draftId ?? crypto.randomUUID();
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
    });
    setDraftStatus("Draft saved");
  }

  useEffect(() => {
    if (isReply) return;
    if (
      !hasDraftContent({
        to: sendTo,
        cc: sendCc,
        subject: sendSubject,
        body: sendText,
      })
    ) {
      return;
    }
    setDraftStatus((prev) => (prev === "Draft saved" ? "Saving…" : prev ?? "Saving…"));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      flushDraft();
    }, AUTOSAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReply, sendCc, sendFrom, sendSubject, sendText, sendTo]);

  useEffect(() => {
    if (isReply) return;
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
  }, [isReply]);

  function discardDraft() {
    closedRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (draftId) store.removeDraft(draftId);
    setDraftId(null);
    setSendTo("");
    setSendCc("");
    setSendSubject("");
    setSendText("");
    setDraftStatus(null);
    router.push(inbox);
  }

  function sendEmail() {
    const toParsed = parseEmailListStrict(sendTo);
    const ccParsed = parseEmailListStrict(sendCc);
    const invalid = [...toParsed.invalid, ...ccParsed.invalid];

    if (!sendFrom) {
      setError("Choose a From account");
      return;
    }
    if (!toParsed.emails.length) {
      setError("Add at least one valid To address");
      return;
    }
    if (invalid.length) {
      setError(`Invalid email address: ${invalid.join(", ")}`);
      return;
    }

    setSending(true);
    setError(null);

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
      inReplyTo: inReplyToParam?.trim() || undefined,
      references: referencesParam?.trim() || undefined,
    };
    const domainKey = domainOf(sendFrom) || "none";
    const sentParams = new URLSearchParams({ sent: "1" });
    sentParams.set("account", sendFrom);

    closedRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (draftId) store.removeDraft(draftId);

    dispatchEmailSendStarted();
    router.push(`${sent}?${sentParams.toString()}`);

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
      } catch (e) {
        dispatchEmailSendFailed(
          e instanceof Error ? e.message : "Send failed",
        );
      }
    })();
  }

  if (isReply && replyKey) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const fromSpecified = Boolean(
    (existingDraft?.from &&
      addresses.some((a) => a.email === existingDraft.from)) ||
      (fromParam?.trim() &&
        addresses.some((a) => a.email === fromParam.trim())) ||
      (accountFilter !== "all" &&
        addresses.some((a) => a.email === accountFilter)),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <h1 className="text-sm font-semibold">Compose email</h1>
      </DesktopTitleBar>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
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
          allowFromSelect={!fromSpecified}
          onDiscard={
            draftId || hasDraftContent({ to: sendTo, cc: sendCc, subject: sendSubject, body: sendText })
              ? discardDraft
              : undefined
          }
        />
      </div>
    </div>
  );
}
