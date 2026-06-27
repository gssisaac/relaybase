"use client";

import { Check, Copy, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  useEmailSender,
  useEmailSenderCacheHint,
} from "@/relaybase/components/EmailSenderContext";
import { EMAIL_SENDER_API } from "@/relaybase/components/constants";
import {
  EmailSenderAlerts,
  EmailSenderToolbar,
} from "@/relaybase/components/EmailSenderShared";
import { integrationSnippet } from "@/relaybase/components/types";
import type {
  EmailSenderLogSummary,
  RelaybaseDashboardAdminTokenRow,
} from "@/relaybase/components/types";
import { useEmailSenderPaths } from "@/relaybase/components/useEmailSenderPaths";
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
import { cn } from "@/lib/utils";

export function EmailSenderStatusView() {
  const { logs } = useEmailSenderPaths();
  const {
    config,
    keys,
    loading,
    refreshing,
    configMeta,
    keysMeta,
    error,
    refreshConfig,
    refreshKeys,
    fetchLogs,
  } = useEmailSender();
  const [logSummary, setLogSummary] = useState<EmailSenderLogSummary | null>(
    null,
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [dashboardTokens, setDashboardTokens] = useState<
    RelaybaseDashboardAdminTokenRow[]
  >([]);
  const [tokenLabel, setTokenLabel] = useState("");
  const [tokenProductId, setTokenProductId] = useState("");
  const [issuingToken, setIssuingToken] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const cacheHint = useEmailSenderCacheHint(configMeta, keysMeta);

  const refreshDashboardTokens = useCallback(async () => {
    try {
      const res = await fetch(`${EMAIL_SENDER_API}/admin-tokens`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        tokens?: RelaybaseDashboardAdminTokenRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load admin tokens");
      setDashboardTokens(data.tokens ?? []);
    } catch (e) {
      setTokenError(
        e instanceof Error ? e.message : "Failed to load admin tokens",
      );
    }
  }, []);

  useEffect(() => {
    void refreshDashboardTokens();
  }, [refreshDashboardTokens]);

  async function issueDashboardToken() {
    setIssuingToken(true);
    setTokenError(null);
    setTokenMessage(null);
    setIssuedToken(null);
    try {
      const res = await fetch(`${EMAIL_SENDER_API}/admin-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: tokenLabel.trim() || undefined,
          productId: tokenProductId.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        token?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Issue failed");
      setIssuedToken(data.token ?? null);
      setTokenLabel("");
      setTokenProductId("");
      setTokenMessage(
        data.message ??
          "Dashboard admin token issued — paste it into the product Email dashboard.",
      );
      await refreshDashboardTokens();
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : "Issue failed");
    } finally {
      setIssuingToken(false);
    }
  }

  async function revokeDashboardToken(id: string) {
    if (
      !window.confirm(
        "Revoke this dashboard admin token? Products using it will lose API access.",
      )
    ) {
      return;
    }
    setRevokingTokenId(id);
    setTokenError(null);
    setTokenMessage(null);
    try {
      const res = await fetch(`${EMAIL_SENDER_API}/admin-tokens/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Revoke failed");
      setTokenMessage("Dashboard admin token revoked");
      await refreshDashboardTokens();
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevokingTokenId(null);
    }
  }

  const refresh = useCallback(
    async (force?: boolean) => {
      await Promise.all([
        refreshConfig({ refresh: force }),
        refreshKeys({ refresh: force }),
        refreshDashboardTokens(),
      ]);
      if (config?.configured) {
        const { data } = await fetchLogs("status-failed", "limit=5&status=failed", {
          refresh: force,
          onUpdate: (next) => setLogSummary(next.summary ?? null),
        });
        setLogSummary(data.summary ?? null);
      } else {
        setLogSummary(null);
      }
    },
    [config?.configured, fetchLogs, refreshConfig, refreshDashboardTokens, refreshKeys],
  );

  useEffect(() => {
    if (!config?.configured) {
      setLogSummary(null);
      return;
    }
    void fetchLogs("status-failed", "limit=5&status=failed", {
      onUpdate: (next) => setLogSummary(next.summary ?? null),
    }).then(({ data }) => setLogSummary(data.summary ?? null));
  }, [config?.configured, fetchLogs]);

  async function copyText(value: string, field: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 2000);
  }

  const workerUrl = config?.workerUrl ?? "";
  const exampleDomain = "yourdomain.com";
  const keyCount = keys.length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <EmailSenderToolbar
        refreshing={refreshing}
        onRefresh={() => void refresh(true)}
        cacheHint={cacheHint}
      />
      <EmailSenderAlerts error={error ?? tokenError} message={tokenMessage} />

      {loading && !config ? (
        <p className="text-sm text-muted-foreground">Loading status…</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Worker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={config?.healthy ? "default" : "destructive"}>
              {config?.configured
                ? config.healthy
                  ? "Healthy"
                  : "Unreachable"
                : "Not connected"}
            </Badge>
            {workerUrl ? (
              <p className="font-mono text-xs break-all text-muted-foreground">
                {workerUrl}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Configure connection in Settings.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">API keys</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{keyCount}</p>
            <p className="text-xs text-muted-foreground">Issued domain keys</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">Cloudflare Email Sending</p>
            <p className="text-xs text-muted-foreground">
              Domains must be onboarded in Cloudflare before sending.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Failures (24h)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                (logSummary?.failedLast24h ?? 0) > 0 && "text-destructive",
              )}
            >
              {logSummary?.failedLast24h ?? 0}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              render={<Link href={logs} />}
            >
              View logs
            </Button>
          </CardContent>
        </Card>
      </div>

      {(logSummary?.failedLast24h ?? 0) > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Send failures detected</AlertTitle>
          <AlertDescription>
            {logSummary?.failedLast24h} failed send
            {logSummary?.failedLast24h === 1 ? "" : "s"} in the last 24 hours.
            Check the Logs tab for validation errors and Cloudflare delivery
            failures.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Dashboard admin tokens</CardTitle>
          <CardDescription>
            Issue per-product <code className="text-xs">rb-admin-…</code> tokens
            for Email dashboards. These authorize API key management in the
            product app — not Cloudflare API tokens (
            <code className="text-xs">cfut_…</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="relaybase-dashboard-token-label">Label (optional)</Label>
              <Input
                id="relaybase-dashboard-token-label"
                value={tokenLabel}
                onChange={(e) => setTokenLabel(e.target.value)}
                placeholder="macpurity email"
                disabled={issuingToken}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relaybase-dashboard-token-product">
                Product ID (optional)
              </Label>
              <Input
                id="relaybase-dashboard-token-product"
                value={tokenProductId}
                onChange={(e) => setTokenProductId(e.target.value)}
                placeholder="macpurity"
                disabled={issuingToken}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => void issueDashboardToken()}
            disabled={issuingToken}
          >
            {issuingToken ? "Issuing…" : "Issue dashboard token"}
          </Button>

          {issuedToken ? (
            <Alert>
              <AlertTitle>Copy this token now</AlertTitle>
              <AlertDescription className="space-y-2">
                <CredentialInput
                  readOnly
                  value={issuedToken}
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void copyText(issuedToken, "issued-admin-token")}
                >
                  {copiedField === "issued-admin-token" ? (
                    <>
                      <Check className="mr-1.5 size-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 size-3.5" />
                      Copy token
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Paste into the product&apos;s Email dashboard → Settings → API
                  Keys.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          {dashboardTokens.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboardTokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell>{token.label ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {token.productId ?? "any"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      rb-admin-{token.tokenPrefix}…
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(token.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={revokingTokenId === token.id}
                        onClick={() => void revokeDashboardToken(token.id)}
                      >
                        <Trash2 className="mr-1 size-3.5" />
                        {revokingTokenId === token.id ? "Revoking…" : "Revoke"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No dashboard tokens issued yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Overview</CardTitle>
          <CardDescription>
            Relaybase issues domain-scoped API keys and sends mail via
            Cloudflare Email Sending. Each key only allows{" "}
            <code className="text-xs">from</code> addresses on its bound domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">1. Connect worker</span>{" "}
            — set worker URL and Cloudflare credentials in Settings.
          </p>
          <p>
            <span className="font-medium text-foreground">2. Issue dashboard token</span>{" "}
            — authorize a product Email dashboard (above).
          </p>
          <p>
            <span className="font-medium text-foreground">3. Issue domain keys</span>{" "}
            — from the dashboard or API Keys tab.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">App integration</CardTitle>
          <CardDescription>
            Example for transactional mail like billing@yourdomain.com
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workerUrl ? (
            <>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                <code>{integrationSnippet(workerUrl, exampleDomain)}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void copyText(
                    integrationSnippet(workerUrl, exampleDomain),
                    "snippet",
                  )
                }
              >
                {copiedField === "snippet" ? (
                  <>
                    <Check className="mr-1.5 size-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 size-3.5" />
                    Copy snippet
                  </>
                )}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Worker URL required to show integration snippet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">API reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium">POST /v1/send</p>
            <p className="text-muted-foreground">
              Auth: <code className="text-xs">Bearer &lt;apiKey&gt;</code>
            </p>
            <p className="mt-1 text-muted-foreground">
              Body: from, to, subject, text, optional html, replyTo
            </p>
          </div>
          <Alert>
            <AlertTitle>Errors</AlertTitle>
            <AlertDescription className="space-y-1 text-xs">
              <p>
                <strong>401</strong> — invalid API key
              </p>
              <p>
                <strong>403</strong> — from address not on key domain
              </p>
              <p>
                <strong>502</strong> — Cloudflare Email Sending failure
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
