"use client";

import Link from "next/link";
import { Check, Copy, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  EmailAlerts,
  PageToolbar,
  RelaybaseConfigAlert,
} from "@/relaybase-email/components/EmailShared";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { useEmailSettings } from "@/relaybase-email/components/useEmailSettings";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
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

type ProductEmailKeyRow = {
  id: string;
  domain: string;
  label: string | null;
  apiKey: string | null;
  active: boolean;
  createdAt: string;
};

export function EmailSettingsKeysView() {
  const productId = useProductId();
  const s = useEmailSettings();
  const { apiBase, settingsDomain } = useEmailPaths();
  const [keys, setKeys] = useState<ProductEmailKeyRow[]>([]);
  const [label, setLabel] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [keysMessage, setKeysMessage] = useState<string | null>(null);

  const domain = s.emailDomain.trim().toLowerCase();
  const relaybaseReady = Boolean(s.config?.relaybaseWorkerUrl);

  const refreshKeys = useCallback(async () => {
    setLoadingKeys(true);
    setKeysError(null);
    try {
      const res = await fetch(`${apiBase}/keys`, { cache: "no-store" });
      const data = (await res.json()) as {
        keys?: ProductEmailKeyRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load keys");
      setKeys(data.keys ?? []);
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : "Failed to load keys");
    } finally {
      setLoadingKeys(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void refreshKeys();
  }, [refreshKeys, s.config?.relaybaseKeyId]);

  async function copyKey(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  async function createKey() {
    if (!domain) {
      setKeysError("Set the email domain in Domain settings before issuing keys");
      return;
    }
    setCreating(true);
    setKeysError(null);
    setKeysMessage(null);
    try {
      const res = await fetch(`${apiBase}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, label: label.trim() || undefined }),
      });
      const data = (await res.json()) as {
        domain?: string;
        label?: string | null;
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setKeysMessage(
        data.message ??
          `Issued API key for ${data.domain}${data.label ? ` (${data.label})` : ""}`,
      );
      setLabel("");
      await s.refresh({ refresh: true });
      await refreshKeys();
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function activateKey(key: ProductEmailKeyRow) {
    if (key.active) return;
    setActivatingId(key.id);
    setKeysError(null);
    setKeysMessage(null);
    try {
      const res = await fetch(`${apiBase}/keys/${key.id}`, {
        method: "PATCH",
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "Activate failed");
      setKeysMessage(data.message ?? `Using key for ${key.domain}`);
      await s.refresh({ refresh: true });
      await refreshKeys();
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : "Activate failed");
    } finally {
      setActivatingId(null);
    }
  }

  async function deleteKey(key: ProductEmailKeyRow) {
    const name = key.label || key.domain;
    if (
      !window.confirm(
        `Delete API key "${name}"? Apps using this key will stop sending.`,
      )
    ) {
      return;
    }
    setDeletingId(key.id);
    setKeysError(null);
    setKeysMessage(null);
    try {
      const res = await fetch(`${apiBase}/keys/${key.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setKeysMessage(`Deleted key for ${key.domain}`);
      await s.refresh({ refresh: true });
      await refreshKeys();
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <PageToolbar
        refreshing={s.refreshing || loadingKeys}
        cacheHint={s.cacheHint}
        onRefresh={() => {
          void s.refresh({ refresh: true });
          void refreshKeys();
        }}
      />
      <EmailAlerts
        error={s.error ?? keysError}
        message={s.message ?? keysMessage}
      />
      <RelaybaseConfigAlert show={!s.relaybaseAdminOk} />

      {!s.relaybaseAdminOk ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Relaybase admin token</CardTitle>
            <CardDescription>
              Paste the <code className="text-xs">rb-admin-…</code> token issued
              from Relaybase → Status. This is not a Cloudflare API token (
              <code className="text-xs">cfut_…</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="relaybase-admin-token">Admin token</Label>
              <CredentialInput
                id="relaybase-admin-token"
                value={s.relaybaseAdminToken}
                onChange={(e) => s.setRelaybaseAdminToken(e.target.value)}
                placeholder="rb-admin-…"
                disabled={s.saving}
                className="font-mono text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={() => void s.saveRelaybaseAdminToken()}
              disabled={s.saving || !s.relaybaseAdminToken.trim()}
            >
              {s.saving ? "Saving…" : "Save admin token"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!relaybaseReady ? (
        <Alert>
          <AlertTitle>Relaybase worker unavailable</AlertTitle>
          <AlertDescription>
            The shared Relaybase worker is not configured yet. Ask your operator
            to finish worker setup in Relaybase before issuing API keys here.
          </AlertDescription>
        </Alert>
      ) : null}

      {!domain ? (
        <Alert>
          <AlertTitle>Email domain required</AlertTitle>
          <AlertDescription>
            Set your sending domain in{" "}
            <Link href={settingsDomain} className="underline">
              Domain settings
            </Link>{" "}
            before issuing keys.
          </AlertDescription>
        </Alert>
      ) : null}

      {relaybaseReady && s.relaybaseAdminOk && domain ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Issue API key</CardTitle>
              <CardDescription>
                Keys are scoped to{" "}
                <span className="font-mono">{domain}</span>. Multiple keys per
                domain are supported — choose which one is active for{" "}
                <span className="font-mono">{productId}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="relaybase-email-domain">Domain</Label>
                  <Input
                    id="relaybase-email-domain"
                    value={domain}
                    readOnly
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="relaybase-email-label">Label (optional)</Label>
                  <Input
                    id="relaybase-email-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="production"
                    disabled={creating}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => void createKey()}
                disabled={creating}
              >
                {creating ? "Issuing…" : "Issue key"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">API keys for {domain}</CardTitle>
              <CardDescription>
                {keys.length
                  ? `${keys.length} key${keys.length === 1 ? "" : "s"}`
                  : "No keys yet for this domain"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingKeys && !keys.length ? (
                <p className="text-sm text-muted-foreground">Loading keys…</p>
              ) : !keys.length ? (
                <p className="text-sm text-muted-foreground">
                  Issue a key above to enable sending for this product.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
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
                                onClick={() =>
                                  void copyKey(key.id, key.apiKey!)
                                }
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
                          <Badge variant={key.active ? "default" : "secondary"}>
                            {key.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {new Date(key.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!key.active ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={activatingId === key.id}
                                onClick={() => void activateKey(key)}
                              >
                                {activatingId === key.id
                                  ? "Activating…"
                                  : "Use key"}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deletingId === key.id}
                              onClick={() => void deleteKey(key)}
                            >
                              <Trash2 className="mr-1 size-3.5" />
                              {deletingId === key.id ? "Deleting…" : "Delete"}
                            </Button>
                          </div>
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
