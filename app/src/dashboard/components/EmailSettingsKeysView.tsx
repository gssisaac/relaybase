"use client";

import Link from "next/link";
import {
  Check,
  Copy,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { SparklineChart } from "@/components/dashboard/SparklineChart";
import { EmailAlerts } from "@/email/components/EmailShared";
import { useDashboardPaths } from "@/dashboard/paths";
import {
  dashboardCacheNeedsRefresh,
  loadApiKeysCache,
  saveApiKeysCache,
} from "@/lib/dashboard/dashboard-cache-disk";
import { useDomain } from "@/lib/dashboard/DomainContext";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type StatsRange = "24h" | "7d" | "30d";

type ProductEmailKeyRow = {
  id: string;
  domain: string;
  label: string | null;
  apiKey: string | null;
  active: boolean;
  createdAt: string;
};

type KeysStats = {
  totals: {
    requests: number;
    errors: number;
    emails: number;
  };
  series: {
    requests: { value: number; label: string }[];
  };
};

type ApiKeysCacheData = {
  keys: ProductEmailKeyRow[];
  stats: KeysStats | null;
  workerUrl: string | null;
  workerConnected: boolean;
};

type ExampleLang = "curl" | "javascript" | "python";

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const EXAMPLE_LANGS: { value: ExampleLang; label: string }[] = [
  { value: "curl", label: "cURL" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
];

function buildSendExamples(params: {
  baseUrl: string;
  apiKey: string;
  from: string;
}): Record<ExampleLang, string> {
  const { baseUrl, apiKey, from } = params;
  const endpoint = `${baseUrl}/v1/send`;
  const body = {
    from,
    fromName: "Your App",
    to: "customer@example.com",
    subject: "Hello from Relaybase",
    text: "Your message is ready.",
  };

  return {
    curl: `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`,
    javascript: `const res = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "${from}",
    fromName: "Your App",
    to: "customer@example.com",
    subject: "Hello from Relaybase",
    text: "Your message is ready.",
  }),
});

const data = await res.json();
if (!res.ok) throw new Error(data.error ?? "Send failed");
console.log(data.messageId);`,
    python: `import requests

res = requests.post(
    "${endpoint}",
    headers={
        "Authorization": "Bearer ${apiKey}",
    },
    json={
        "from": "${from}",
        "fromName": "Your App",
        "to": "customer@example.com",
        "subject": "Hello from Relaybase",
        "text": "Your message is ready.",
    },
)
res.raise_for_status()
print(res.json()["messageId"])`,
  };
}

export function EmailSettingsKeysView() {
  const { apiBase, domains: domainsHref } = useDashboardPaths();
  const { domains } = useDomain();
  const readyDomains = useMemo(
    () =>
      domains.filter((d) => !d.onboarding || d.onboarding.status === "ready"),
    [domains],
  );

  const [keys, setKeys] = useState<ProductEmailKeyRow[]>([]);
  const [stats, setStats] = useState<KeysStats | null>(null);
  const [workerUrl, setWorkerUrl] = useState<string | null>(null);
  const [workerConnected, setWorkerConnected] = useState<boolean | null>(null);
  const [range, setRange] = useState<StatsRange>("7d");
  const [exampleLang, setExampleLang] = useState<ExampleLang>("curl");
  const [exampleCopied, setExampleCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [issueDomain, setIssueDomain] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ProductEmailKeyRow | null>(
    null,
  );
  const [revoking, setRevoking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [keysMessage, setKeysMessage] = useState<string | null>(null);

  const applyCacheData = useCallback((data: ApiKeysCacheData) => {
    setKeys(data.keys);
    setStats(data.stats);
    setWorkerUrl(data.workerUrl);
    setWorkerConnected(data.workerConnected);
  }, []);

  const refreshKeys = useCallback(
    async (force?: boolean) => {
      setKeysError(null);

      const cached = await loadApiKeysCache<ApiKeysCacheData>(range);
      // Never re-apply stale cache on force refresh (e.g. after revoke).
      if (cached && !force) {
        applyCacheData(cached.data);
        setLoadingKeys(false);
      } else if (!cached && !force) {
        // Don't flash another range's keys while the first fetch runs.
        setKeys([]);
        setStats(null);
      }

      const needsNetwork =
        force === true ||
        !cached ||
        dashboardCacheNeedsRefresh(cached.fetchedAt);

      if (!needsNetwork) return;

      // Keep cached rows on screen; only spin the refresh control.
      if (cached) setRefreshing(true);
      else setLoadingKeys(true);

      try {
        const res = await fetch(
          `${apiBase}/keys?range=${encodeURIComponent(range)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          keys?: ProductEmailKeyRow[];
          stats?: KeysStats;
          workerUrl?: string | null;
          workerConnected?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load keys");
        const next: ApiKeysCacheData = {
          keys: data.keys ?? [],
          stats: data.stats ?? null,
          workerUrl: data.workerUrl ?? null,
          workerConnected: Boolean(data.workerConnected),
        };
        applyCacheData(next);
        await saveApiKeysCache(range, next);
      } catch (e) {
        setKeysError(e instanceof Error ? e.message : "Failed to load keys");
      } finally {
        setLoadingKeys(false);
        setRefreshing(false);
      }
    },
    [apiBase, applyCacheData, range],
  );

  useEffect(() => {
    void refreshKeys();
  }, [refreshKeys]);

  useEffect(() => {
    if (!addOpen) return;
    setIssueDomain((current) => {
      if (current && readyDomains.some((d) => d.domain === current)) {
        return current;
      }
      return readyDomains[0]?.domain ?? null;
    });
  }, [addOpen, readyDomains]);

  async function copyKey(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  async function createKey() {
    const domain = issueDomain?.trim().toLowerCase() ?? "";
    if (!domain) {
      setKeysError("Select a domain before issuing keys");
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
      setAddOpen(false);
      await refreshKeys(true);
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
      await refreshKeys(true);
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : "Activate failed");
    } finally {
      setActivatingId(null);
    }
  }

  async function rotateKey(key: ProductEmailKeyRow) {
    setRotatingId(key.id);
    setKeysError(null);
    setKeysMessage(null);
    try {
      const res = await fetch(`${apiBase}/keys/${key.id}/rotate`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        apiKey?: string;
        id?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Rotate failed");
      setKeysMessage(data.message ?? `Rotated key for ${key.domain}`);
      await refreshKeys(true);
      if (data.apiKey && data.id) {
        await copyKey(data.id, data.apiKey);
        setKeysMessage(
          `${data.message ?? "Key rotated"} — new secret copied to clipboard`,
        );
      }
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : "Rotate failed");
    } finally {
      setRotatingId(null);
    }
  }

  async function confirmRevoke() {
    const key = revokeTarget;
    if (!key) return;
    setRevoking(true);
    setKeysError(null);
    setKeysMessage(null);
    try {
      const res = await fetch(`${apiBase}/keys/${encodeURIComponent(key.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Revoke failed");

      const nextKeys = keys.filter((entry) => entry.id !== key.id);
      setKeys(nextKeys);
      await saveApiKeysCache(range, {
        keys: nextKeys,
        stats,
        workerUrl,
        workerConnected: workerConnected === true,
      });
      setKeysMessage(`Revoked key for ${key.domain}`);
      setRevokeTarget(null);
      await refreshKeys(true);
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevoking(false);
    }
  }

  const showWorkerUnavailable = workerConnected === false && !loadingKeys;
  const canIssue = readyDomains.length > 0 && workerConnected === true;
  const requestSeries = stats?.series.requests.map((b) => b.value) ?? [];
  const requestTotal = stats?.totals.requests ?? 0;
  const errorTotal = stats?.totals.errors ?? 0;

  const exampleKey =
    keys.find((key) => key.active && key.apiKey) ??
    keys.find((key) => key.apiKey) ??
    null;
  const exampleApiKey = exampleKey?.apiKey ?? "YOUR_API_KEY";
  const exampleDomain =
    exampleKey?.domain.trim().toLowerCase() ||
    readyDomains[0]?.domain ||
    "yourdomain.com";
  const exampleBaseUrl = workerUrl ?? "https://api.relaybase.xyz";
  const exampleFrom = `hello@${exampleDomain}`;
  const examples = buildSendExamples({
    baseUrl: exampleBaseUrl,
    apiKey: exampleApiKey,
    from: exampleFrom,
  });
  const exampleCode = examples[exampleLang];

  async function copyExample() {
    await navigator.clipboard.writeText(exampleCode);
    setExampleCopied(true);
    window.setTimeout(() => setExampleCopied(false), 2000);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setLabel("");
            setIssueDomain(null);
          }
        }}
      >
        <DesktopTitleBar
          className="px-4 py-3"
          end={
            <>
              <DialogTrigger
                render={<Button size="sm" disabled={!canIssue} />}
              >
                <Plus className="size-4" />
                Issue key
              </DialogTrigger>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshKeys(true)}
                disabled={refreshing}
              >
                <RefreshCw
                  className={cn("size-4", refreshing && "animate-spin")}
                />
              </Button>
            </>
          }
        >
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">API Keys</h1>
            <p className="text-sm text-muted-foreground">
              Issue and manage send keys across your domains.
            </p>
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue API key</DialogTitle>
            <DialogDescription>
              Keys are scoped to a single sending domain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Domain</Label>
              <Select
                value={issueDomain}
                onValueChange={(v) => v && setIssueDomain(v)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {readyDomains.map((d) => (
                    <SelectItem key={d.domain} value={d.domain}>
                      {d.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {readyDomains.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No ready domains yet — finish onboarding a domain first.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relaybase-email-label">Label (optional)</Label>
              <Input
                id="relaybase-email-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="production"
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void createKey();
                  }
                }}
              />
            </div>
            <Button
              className="w-full"
              size="sm"
              onClick={() => void createKey()}
              disabled={creating || !canIssue || !issueDomain}
            >
              {creating ? "Issuing…" : "Issue key"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <EmailAlerts error={keysError} message={keysMessage} />

        {showWorkerUnavailable ? (
          <Alert>
            <AlertTitle>Relaybase worker unavailable</AlertTitle>
            <AlertDescription>
              Could not reach the Relaybase worker. Check that{" "}
              <span className="font-mono">RELAYBASE_URL</span> and the admin
              service token are configured, then refresh.
            </AlertDescription>
          </Alert>
        ) : null}

        {!readyDomains.length && !loadingKeys ? (
          <Alert>
            <AlertTitle>Domain required</AlertTitle>
            <AlertDescription>
              Add a sending domain on the{" "}
              <Link href={domainsHref} className="underline">
                Domains
              </Link>{" "}
              page before issuing keys.
            </AlertDescription>
          </Alert>
        ) : null}

        {workerConnected !== false ? (
          <>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardDescription>Send API requests</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {requestTotal.toLocaleString()}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {errorTotal > 0 ? (
                      <span className="text-destructive">
                        {errorTotal.toLocaleString()} errors
                      </span>
                    ) : (
                      "No errors"
                    )}
                    {" · "}
                    {range}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {RANGE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={range === option.value ? "default" : "outline"}
                      onClick={() => setRange(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <SparklineChart
                  data={requestSeries}
                  color="#22c55e"
                  className="h-28"
                  height={112}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">API keys</CardTitle>
                <CardDescription>
                  {keys.length
                    ? `${keys.length} key${keys.length === 1 ? "" : "s"}`
                    : "No keys yet"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingKeys && !keys.length ? (
                  <p className="text-sm text-muted-foreground">Loading keys…</p>
                ) : !keys.length ? (
                  <div className="space-y-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      Issue a key to enable sending for a domain.
                    </p>
                    <Button
                      size="sm"
                      disabled={!canIssue}
                      onClick={() => setAddOpen(true)}
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      Issue key
                    </Button>
                  </div>
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
                          <TableCell className="font-mono text-xs">
                            {key.domain}
                          </TableCell>
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
                            <Badge
                              variant={key.active ? "default" : "secondary"}
                            >
                              {key.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {new Date(key.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    disabled={
                                      rotatingId === key.id ||
                                      activatingId === key.id ||
                                      (revoking &&
                                        revokeTarget?.id === key.id)
                                    }
                                    aria-label={`More actions for ${key.label || key.domain}`}
                                  />
                                }
                              >
                                <MoreHorizontal className="size-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!key.active ? (
                                  <DropdownMenuItem
                                    disabled={!key.apiKey || activatingId === key.id}
                                    onClick={() => void activateKey(key)}
                                  >
                                    Use key
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  disabled={rotatingId === key.id}
                                  onClick={() => void rotateKey(key)}
                                >
                                  <RotateCw className="size-3.5" />
                                  Rotate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setRevokeTarget(key)}
                                >
                                  <Trash2 className="size-3.5" />
                                  Revoke
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">How to send email</CardTitle>
                <CardDescription>
                  Call <span className="font-mono">POST /v1/send</span> with
                  your API key. <span className="font-mono">from</span> must be
                  an address on{" "}
                  <span className="font-mono">{exampleDomain}</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {EXAMPLE_LANGS.map((option) => (
                      <Button
                        key={option.value}
                        size="sm"
                        variant={
                          exampleLang === option.value ? "default" : "outline"
                        }
                        onClick={() => setExampleLang(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyExample()}
                  >
                    {exampleCopied ? (
                      <Check className="mr-1 size-3.5" />
                    ) : (
                      <Copy className="mr-1 size-3.5" />
                    )}
                    {exampleCopied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-border/60 bg-black/40 p-3 font-mono text-xs leading-relaxed whitespace-pre">
                  {exampleCode}
                </pre>
                <p className="text-xs text-muted-foreground">
                  Endpoint:{" "}
                  <span className="font-mono">
                    {exampleBaseUrl}/v1/send
                  </span>
                  {exampleApiKey === "YOUR_API_KEY"
                    ? " · Replace YOUR_API_KEY with a key from the list above."
                    : " · Example uses your active key secret."}
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <Dialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevokeTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!revoking}>
          <DialogHeader>
            <DialogTitle>Revoke API key</DialogTitle>
            <DialogDescription>
              Revoke{" "}
              <span className="font-mono text-foreground">
                {revokeTarget?.label || revokeTarget?.domain}
              </span>
              ? Apps using this key will stop sending immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={revoking}
              onClick={() => setRevokeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={revoking}
              onClick={() => void confirmRevoke()}
            >
              {revoking ? "Revoking…" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
