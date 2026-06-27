"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useEmailSender } from "@/relaybase/components/EmailSenderContext";
import { EmailSenderComposeForm } from "@/relaybase/components/EmailSenderComposeForm";
import { EMAIL_SENDER_API } from "@/relaybase/components/constants";
import type { EmailSenderKeyOption } from "@/relaybase/components/types";
import { useEmailSenderPaths } from "@/relaybase/components/useEmailSenderPaths";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function EmailSenderComposeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { email } = useEmailSenderPaths();
  const { config, keys: keyRows, loading } = useEmailSender();

  const configured = Boolean(config?.configured);
  const keys = useMemo<EmailSenderKeyOption[]>(
    () =>
      keyRows
        .filter((key) => key.active && key.storedLocally && key.apiKey)
        .map((key) => ({
          id: key.id,
          domain: key.domain,
          label: key.label,
        })),
    [keyRows],
  );

  const [error, setError] = useState<string | null>(null);
  const [keyId, setKeyId] = useState("");
  const [sendFrom, setSendFrom] = useState("");
  const [sendFromName, setSendFromName] = useState("MacPurity");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const keyFromQuery = searchParams.get("keyId")?.trim();
    const initialKey =
      (keyFromQuery && keys.find((key) => key.id === keyFromQuery)?.id) ||
      keys[0]?.id ||
      "";
    if (initialKey) setKeyId(initialKey);
  }, [keys, searchParams]);

  useEffect(() => {
    const selected = keys.find((key) => key.id === keyId);
    if (!selected) return;
    setSendFrom((current) => {
      if (current && current.endsWith(`@${selected.domain}`)) return current;
      return `billing@${selected.domain}`;
    });
  }, [keyId, keys]);

  async function sendEmail() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${EMAIL_SENDER_API}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId,
          from: sendFrom,
          fromName: sendFromName.trim() || undefined,
          to: sendTo,
          subject: sendSubject,
          text: sendText,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      router.push(`${email}?sent=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={<Link href={email} />}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h1 className="min-w-0 flex-1 text-sm font-semibold">
          Compose test email
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading && !config ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && !configured ? (
          <Alert className="mb-4">
            <AlertTitle>Connection required</AlertTitle>
            <AlertDescription>
              Configure Relaybase in Settings before sending.
            </AlertDescription>
          </Alert>
        ) : null}

        {!loading && configured && !keys.length ? (
          <Alert className="mb-4">
            <AlertTitle>No usable API keys</AlertTitle>
            <AlertDescription>
              Issue an API key in API Keys first. Keys must be stored locally to
              send from this dashboard.
            </AlertDescription>
          </Alert>
        ) : null}

        <EmailSenderComposeForm
          keys={keys}
          keyId={keyId}
          setKeyId={setKeyId}
          sendFrom={sendFrom}
          setSendFrom={setSendFrom}
          sendFromName={sendFromName}
          setSendFromName={setSendFromName}
          sendTo={sendTo}
          setSendTo={setSendTo}
          sendSubject={sendSubject}
          setSendSubject={setSendSubject}
          sendText={sendText}
          setSendText={setSendText}
          sending={sending}
          onSend={() => void sendEmail()}
        />
      </div>
    </div>
  );
}
