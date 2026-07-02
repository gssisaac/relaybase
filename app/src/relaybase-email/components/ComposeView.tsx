"use client";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { ComposeForm } from "@/relaybase-email/components/ComposeForm";
import { useEmailMailbox } from "@/relaybase-email/components/EmailMailboxContext";
import { clearEmailCache } from "@/relaybase-email/components/email-cached-fetch";
import { parseEmailListStrict } from "@/lib/email/parse-recipients";

function defaultFrom(addresses: { email: string }[]) {
  return addresses[0]?.email ?? "";
}

export function ComposeView() {
  const productId = useProductId();
  const { activeDomain } = useDomain();
  const { apiBase, sent } = useEmailPaths();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReply = searchParams.get("reply") === "1";
  const toParam = searchParams.get("to");
  const subjectParam = searchParams.get("subject");
  const fromParam = searchParams.get("from");

  const {
    addresses,
    accountFilter,
    refresh,
    setError,
    setMessage,
  } = useEmailMailbox();

  const [sendFrom, setSendFrom] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendCc, setSendCc] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fromQuery = fromParam?.trim();
    const resolvedFrom =
      fromQuery && addresses.some((a) => a.email === fromQuery)
        ? fromQuery
        : accountFilter !== "all"
          ? accountFilter
          : defaultFrom(addresses);
    if (resolvedFrom) setSendFrom(resolvedFrom);
  }, [accountFilter, addresses, fromParam]);

  useEffect(() => {
    const toQuery = toParam?.trim();
    if (toQuery) setSendTo(toQuery);
    const subjectQuery = subjectParam?.trim();
    if (subjectQuery) setSendSubject(subjectQuery);
  }, [subjectParam, toParam]);

  async function sendEmail() {
    const toParsed = parseEmailListStrict(sendTo);
    const ccParsed = parseEmailListStrict(sendCc);
    const invalid = [...toParsed.invalid, ...ccParsed.invalid];

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
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      const domainKey = activeDomain ?? "none";
      clearEmailCache(productId, `sent:${domainKey}`);
      await refresh(true);
      router.push(`${sent}?sent=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold">
          {isReply ? "Reply" : "Compose email"}
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col gap-4 p-6">
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
          />
        </div>
      </div>
    </div>
  );
}
