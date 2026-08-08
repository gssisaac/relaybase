"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

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
import { parseEmailListStrict } from "@/lib/email/parse-recipients";
import type { RoutingActivityEvent } from "@/email/components/types";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function formatQuoteDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? "AM" : "PM";
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${hour12}:${minutes} ${ampm}`;
}

function quoteInboundMessage(event: RoutingActivityEvent): string {
  const body = (event.bodyText || event.bodyPreview || "").replace(/\s+$/g, "");
  const quoted = body
    ? body
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join("\n")
    : ">";
  return `\n\nOn ${formatQuoteDate(event.receivedAt)}, ${event.fromEmail} wrote:\n\n${quoted}`;
}

function replyAllCc(
  event: RoutingActivityEvent,
  sendFrom: string,
): string {
  const exclude = new Set(
    [event.fromEmail, sendFrom]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const recipients = [
    ...(event.toEmails?.length ? event.toEmails : [event.toEmail]),
    ...(event.ccEmails ?? []),
  ];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const email of recipients) {
    const trimmed = email.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (exclude.has(key) || seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique.join(", ");
}

function domainOf(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}

export function ComposeView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { sent } = useMailboxNav();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReply = searchParams.get("reply") === "1";
  const isReplyAll = searchParams.get("replyAll") === "1";
  const replyKey = searchParams.get("replyKey")?.trim() || "";
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
    setMessage,
  } = useEmailMailbox();

  const [sendFrom, setSendFrom] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendCc, setSendCc] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyHydratedKey, setReplyHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = fromParam?.trim();
    const resolvedFrom =
      fromQuery && addresses.some((a) => a.email === fromQuery)
        ? fromQuery
        : accountFilter !== "all"
          ? accountFilter
          : "";
    setSendFrom(resolvedFrom);
  }, [accountFilter, addresses, fromParam]);

  useEffect(() => {
    const toQuery = toParam?.trim();
    if (toQuery) setSendTo(toQuery);
    const ccQuery = ccParam?.trim();
    if (ccQuery) setSendCc(ccQuery);
    const subjectQuery = subjectParam?.trim();
    if (subjectQuery) setSendSubject(subjectQuery);
  }, [ccParam, subjectParam, toParam]);

  useEffect(() => {
    if (!isReply || !replyKey || replyHydratedKey === replyKey) return;

    let cancelled = false;
    void (async () => {
      try {
        const domain =
          (fromParam ? domainOf(fromParam) : "") ||
          (accountFilter !== "all" ? domainOf(accountFilter) : "") ||
          "";
        const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
        const res = await fetch(
          `${apiBase}/inbox/${encodeURIComponent(replyKey)}${qs}`,
        );
        const data = (await res.json()) as RoutingActivityEvent & {
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load message");
        if (cancelled) return;

        const fromQuery = fromParam?.trim();
        const resolvedFrom =
          (fromQuery && addresses.some((a) => a.email === fromQuery)
            ? fromQuery
            : addresses.find(
                (a) => a.email.toLowerCase() === data.toEmail.toLowerCase(),
              )?.email) ||
          (accountFilter !== "all" ? accountFilter : "") ||
          addresses[0]?.email ||
          "";

        setSendFrom(resolvedFrom);
        setSendTo(data.fromEmail);
        setSendCc(isReplyAll ? replyAllCc(data, resolvedFrom) : "");
        setSendSubject(
          data.subject.startsWith("Re:")
            ? data.subject
            : `Re: ${data.subject || "(no subject)"}`,
        );
        setSendText(quoteInboundMessage(data));
        setReplyHydratedKey(replyKey);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load reply context",
          );
          setReplyHydratedKey(replyKey);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    accountFilter,
    addresses,
    apiBase,
    fromParam,
    isReply,
    isReplyAll,
    replyHydratedKey,
    replyKey,
    setError,
  ]);

  function sendEmail() {
    const toParsed = parseEmailListStrict(sendTo);
    const ccParsed = parseEmailListStrict(sendCc);
    const invalid = [...toParsed.invalid, ...ccParsed.invalid];

    if (!sendFrom) {
      setError("Choose Compose under an account in the sidebar");
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
    setMessage(null);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <h1 className="text-sm font-semibold">
          {isReplyAll ? "Reply all" : isReply ? "Reply" : "Compose email"}
        </h1>
      </DesktopTitleBar>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <ComposeForm
          sendFrom={sendFrom}
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
  );
}
