"use client";

import { Pencil, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  useEmailSender,
  useEmailSenderCacheHint,
} from "@/relaybase/components/EmailSenderContext";
import type { CacheMeta } from "@/lib/dashboard/shared/cached-fetch";
import type { EmailSenderSentEmail } from "@/relaybase/components/types";
import { useEmailSenderPaths } from "@/relaybase/components/useEmailSenderPaths";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DetailView,
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
  SegmentTabs,
} from "@/relaybase-email/components/EmailListShell";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailSenderEmailsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { compose, email } = useEmailSenderPaths();
  const {
    config,
    loading,
    refreshing,
    configMeta,
    fetchSent,
  } = useEmailSender();
  const configured = Boolean(config?.configured);

  const [sent, setSent] = useState<EmailSenderSentEmail[]>([]);
  const [sentMeta, setSentMeta] = useState<CacheMeta | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cacheHint = useEmailSenderCacheHint(configMeta, sentMeta);

  const refresh = useCallback(async (force?: boolean) => {
    setError(null);
    try {
      const { data, meta } = await fetchSent({
        refresh: force,
        onUpdate: (next) => setSent(next.sent ?? []),
      });
      setSent(data.sent ?? []);
      setSentMeta(meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    }
  }, [fetchSent]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (searchParams.get("sent") === "1") {
      setMessage("Test email sent via Relaybase");
      router.replace(email);
    }
  }, [searchParams, router, email]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sent
      .slice()
      .sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      )
      .filter((item) => {
        if (!q) return true;
        return (
          item.subject.toLowerCase().includes(q) ||
          item.to.toLowerCase().includes(q) ||
          item.from.toLowerCase().includes(q)
        );
      })
      .map((message) => ({
        id: message.id,
        message,
      }));
  }, [sent, search]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  function closeDetail() {
    setSelectedId(null);
  }

  if (selected) {
    const m = selected.message;
    return (
      <div className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {message ? (
          <Alert>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <EmailListContainer>
          <DetailView title={m.subject} onBack={closeDetail}>
            <p className="mb-4 text-xs text-muted-foreground">
              To {m.to} · From {m.from} · {formatDate(m.sentAt)}
            </p>
            <dl className="mb-4 grid gap-2 text-xs text-muted-foreground">
              <div>
                <dt className="inline font-medium text-foreground">Key: </dt>
                <dd className="inline">
                  {m.keyLabel ? `${m.keyLabel} · ` : ""}
                  {m.domain}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">
                  Message ID:{" "}
                </dt>
                <dd className="inline font-mono">{m.messageId}</dd>
              </div>
            </dl>
            <pre className="whitespace-pre-wrap text-sm">{m.bodyPreview}</pre>
          </DetailView>
        </EmailListContainer>
      </div>
    );
  }

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentTabs
          value="sending"
          onChange={() => undefined}
          options={[{ value: "sending", label: "Sending" }]}
        />
        <div className="flex items-center gap-3">
          {cacheHint ? (
            <span className="text-xs text-muted-foreground">{cacheHint}</span>
          ) : null}
          <Button
            size="sm"
            disabled={!configured}
            render={<Link href={compose} />}
          >
            <Pencil className="size-4" />
            Compose
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <Alert>
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !configured ? (
        <Alert>
          <AlertTitle>Connection required</AlertTitle>
          <AlertDescription>
            Configure Relaybase in Settings and issue an API key before
            sending test mail.
          </AlertDescription>
        </Alert>
      ) : null}

      <EmailListContainer>
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search sent mail…"
        />
        {items.length > 0 ? (
          <>
            <EmailTableHeader>
              <span>To</span>
              <span className="hidden sm:block">Subject</span>
              <span className="hidden sm:block">Date</span>
              <span className="text-right">Status</span>
            </EmailTableHeader>
            <div>
              {items.map((item) => {
                const m = item.message;
                return (
                  <EmailTableRow
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    primary={m.to}
                    secondary={`From ${m.from}`}
                    subject={m.subject}
                    date={formatDate(m.sentAt)}
                    status={
                      <Badge variant="outline" className="text-[10px]">
                        Sent
                      </Badge>
                    }
                  />
                );
              })}
            </div>
          </>
        ) : !loading ? (
          <EmptyListState
            icon={Send}
            title="No test emails yet"
            description="Compose a test email with a domain API key via Relaybase."
            action={
              <Button
                size="sm"
                disabled={!configured}
                render={<Link href={compose} />}
              >
                Compose email
              </Button>
            }
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Loading sent mail…</p>
        )}
      </EmailListContainer>
    </div>
  );
}
