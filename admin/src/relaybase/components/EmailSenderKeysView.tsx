"use client";

import { Check, Copy, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useEmailSender,
  useEmailSenderCacheHint,
} from "@/relaybase/components/EmailSenderContext";
import { RELAYBASE_API } from "@/relaybase/components/constants";
import {
  EmailSenderAlerts,
  EmailSenderToolbar,
} from "@/relaybase/components/EmailSenderShared";
import type { EmailSenderKeyRow } from "@/relaybase/components/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CredentialInput } from "@/components/ui/credential-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function EmailSenderKeysView() {
  const {
    config,
    keys,
    loading,
    refreshing,
    configMeta,
    keysMeta,
    error: ctxError,
    refreshKeys,
    invalidateConfig,
  } = useEmailSender();
  const configured = Boolean(config?.configured);
  const cacheHint = useEmailSenderCacheHint(configMeta, keysMeta);
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function copyKey(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  async function createKey() {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${RELAYBASE_API}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          label: label.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        domain?: string;
        label?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setMessage(
        `Issued API key for ${data.domain}${data.label ? ` (${data.label})` : ""}`,
      );
      setDomain("");
      setLabel("");
      invalidateConfig();
      await refreshKeys({ refresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(key: EmailSenderKeyRow) {
    const name = key.label || key.domain;
    if (
      !window.confirm(
        `Delete API key "${name}"? Apps using this key will stop sending.`,
      )
    ) {
      return;
    }
    setDeletingId(key.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${RELAYBASE_API}/keys/${key.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setMessage(`Deleted key for ${key.domain}`);
      invalidateConfig();
      await refreshKeys({ refresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <EmailSenderToolbar
        refreshing={refreshing}
        onRefresh={() => void refreshKeys({ refresh: true })}
        cacheHint={cacheHint}
      />
      <EmailSenderAlerts error={error ?? ctxError} message={message} />

      {loading && !config ? (
        <p className="text-sm text-muted-foreground">Loading keys…</p>
      ) : null}

      {!loading && !configured ? (
        <Alert>
          <AlertTitle>Connection required</AlertTitle>
          <AlertDescription>
            Set the worker URL and Cloudflare credentials in Settings before
            issuing keys.
          </AlertDescription>
        </Alert>
      ) : null}

      {configured ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Issue API key</CardTitle>
              <CardDescription>
                Each key is bound to one domain. Keys are stored locally so you
                can view and copy them anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="relaybase-domain">Domain</Label>
                  <Input
                    id="relaybase-domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="yourdomain.com"
                    disabled={creating}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="relaybase-label">Label (optional)</Label>
                  <Input
                    id="relaybase-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="billing-product"
                    disabled={creating}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => void createKey()}
                disabled={creating || !domain.trim()}
              >
                {creating ? "Issuing…" : "Issue key"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Issued keys</CardTitle>
              <CardDescription>
                {keys.length
                  ? `${keys.length} key${keys.length === 1 ? "" : "s"}`
                  : "No keys yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!keys.length ? (
                <p className="text-sm text-muted-foreground">
                  Issue a key above to enable sending for a domain.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>API key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.domain}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {key.label ?? "—"}
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          {key.apiKey ? (
                            <div className="flex items-center gap-1">
                              <CredentialInput
                                readOnly
                                value={key.apiKey}
                                className="h-8 font-mono text-xs"
                                aria-label={`API key for ${key.domain}`}
                              />
                              <Button
                                size="icon-sm"
                                variant="outline"
                                aria-label="Copy API key"
                                onClick={() => void copyKey(key.id, key.apiKey!)}
                              >
                                {copiedId === key.id ? (
                                  <Check className="size-3.5" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Not stored locally
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={key.active ? "outline" : "secondary"}>
                            {key.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {new Date(key.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deletingId === key.id}
                            onClick={() => void deleteKey(key)}
                          >
                            <Trash2 className="mr-1 size-3.5" />
                            {deletingId === key.id ? "Deleting…" : "Delete"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
