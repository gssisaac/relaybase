"use client";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ComposeForm } from "@/relaybase-email/components/ComposeForm";
import {
  fetchEmailCached,
  fetchEmailCachedOptional,
} from "@/relaybase-email/components/email-cached-fetch";
import {
  RelaybaseConfigAlert,
  EmailAlerts,
} from "@/relaybase-email/components/EmailShared";
import { readEmailStale } from "@/relaybase-email/components/useEmailViewLoading";
import type { Address, EmailConfig } from "@/relaybase-email/components/types";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { Button } from "@/components/ui/button";

function defaultFrom(addresses: Address[]) {
  return addresses[0]?.email ?? "";
}

export function ComposeView() {
  const productId = useProductId();
  const { apiBase, emails } = useEmailPaths();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReply = searchParams.get("reply") === "1";
  const toParam = searchParams.get("to");
  const subjectParam = searchParams.get("subject");
  const fromParam = searchParams.get("from");

  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<EmailConfig>(productId, "config") === null &&
      readEmailStale<{ addresses?: Address[] }>(productId, "addresses") === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [sendFrom, setSendFrom] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);

  const dataRef = useRef({ config, addresses });
  dataRef.current = { config, addresses };

  useEffect(() => {
    const staleConfig = readEmailStale<EmailConfig>(productId, "config");
    if (staleConfig) setConfig(staleConfig);
    const staleAddresses = readEmailStale<{ addresses?: Address[] }>(
      productId,
      "addresses",
    );
    if (staleAddresses) {
      const list = staleAddresses.addresses ?? [];
      setAddresses(list);
      const fromQuery = fromParam?.trim();
      const resolvedFrom =
        fromQuery && list.some((a) => a.email === fromQuery)
          ? fromQuery
          : defaultFrom(list);
      if (resolvedFrom) setSendFrom(resolvedFrom);
    }
    const toQuery = toParam?.trim();
    if (toQuery) setSendTo(toQuery);
    const subjectQuery = subjectParam?.trim();
    if (subjectQuery) setSendSubject(subjectQuery);
    if (staleConfig || staleAddresses) setLoading(false);
  }, [fromParam, productId, subjectParam, toParam]);

  const refresh = useCallback(
    async (force?: boolean) => {
      const hasData =
        dataRef.current.config !== null || dataRef.current.addresses.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const [cfgResult, addrResult] = await Promise.all([
          fetchEmailCached<EmailConfig>(productId, "config", `${apiBase}/config`, {
            refresh: force,
            onUpdate: (data) => setConfig(data),
          }),
          fetchEmailCachedOptional<{ addresses?: Address[] }>(
            productId,
            "addresses",
            `${apiBase}/addresses`,
            {
              refresh: force,
              onUpdate: (data) => {
                const list = data?.addresses ?? [];
                setAddresses(list);
                const fromQuery = fromParam?.trim();
                const resolvedFrom =
                  fromQuery && list.some((a) => a.email === fromQuery)
                    ? fromQuery
                    : defaultFrom(list);
                if (resolvedFrom) setSendFrom(resolvedFrom);
              },
            },
          ),
        ]);
        setConfig(cfgResult.data);

        if (addrResult.ok) {
          const list = addrResult.data?.addresses ?? [];
          setAddresses(list);
          const fromQuery = fromParam?.trim();
          const resolvedFrom =
            fromQuery && list.some((a) => a.email === fromQuery)
              ? fromQuery
              : defaultFrom(list);
          if (resolvedFrom) setSendFrom(resolvedFrom);
        }

        const toQuery = toParam?.trim();
        if (toQuery) setSendTo(toQuery);

        const subjectQuery = subjectParam?.trim();
        if (subjectQuery) setSendSubject(subjectQuery);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, fromParam, productId, subjectParam, toParam],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function sendEmail() {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: sendFrom,
          to: sendTo,
          subject: sendSubject,
          text: sendText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      router.push(`${emails}?sent=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }


  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="sm" className="-ml-2" render={<Link href={emails} />}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h1 className="min-w-0 flex-1 text-sm font-semibold">
          {isReply ? "Reply" : "Compose email"}
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
          <EmailAlerts error={error} message={message} />
          <RelaybaseConfigAlert show={!config?.relaybaseConfigured} />

          <ComposeForm
            sendFrom={sendFrom}
            setSendFrom={setSendFrom}
            addresses={addresses}
            sendTo={sendTo}
            setSendTo={setSendTo}
            sendSubject={sendSubject}
            setSendSubject={setSendSubject}
            sendText={sendText}
            setSendText={setSendText}
            sending={sending}
            onSend={sendEmail}
            emailDomain={config?.emailDomain || config?.domain}
          />
        </div>
      </div>
    </div>
  );
}
