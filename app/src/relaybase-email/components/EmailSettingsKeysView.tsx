"use client";

import Link from "next/link";
import { Check, Copy, Plus, RefreshCw, RotateCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SparklineChart } from "@/components/dashboard/SparklineChart";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { EmailAlerts } from "@/relaybase-email/components/EmailShared";
import { CurrentDomainSelect } from "@/relaybase-email/components/CurrentDomainSelect";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const { domainQuery, activeDomain, domains } = useDomain();
  const { apiBase, domains: domainsHref } = useEmailPaths();
  const [keys, setKeys] = useState<ProductEmailKeyRow[]>([]);
  const [stats, setStats] = useState<KeysStats | null>(null);
  const [workerUrl, setWorkerUrl] = useState<string | null>(null);
  const [workerConnected, setWorkerConnected] = useState<boolean | null>(null);
  const [range, setRange] = useState<StatsRange>("7d");
  const [exampleLang, setExampleLang] = useState<ExampleLang>("curl");
  const [exampleCopied, setExampleCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [keysMessage, setKeysMessage] = useState<string | null>(null);

  const domain = (activeDomain ?? "").trim().toLowerCase();

  const refreshKeys = useCallback(
    async (force?: boolean) => {
      if (force) setRefreshing(true);
      else setLoadingKeys(true);
      setKeysError(null);
      try {
        const res = await fetch(`${apiBase}/keys${domainQuery({ range })}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          keys?: ProductEmailKeyRow[];
          stats?: KeysStats;
          workerUrl?: string | null;
          workerConnected?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load keys");
        setKeys(data.keys ?? []);
        setStats(data.stats ?? null);
        setWorkerUrl(data.workerUrl ?? null);
        setWorkerConnected(Boolean(data.workerConnected));
      } catch (e) {
        setKeysError(e instanceof Error ? e.message : "Failed to load keys");
      } finally {
        setLoadingKeys(false);
        setRefreshing(false);
      }
    },
    [apiBase, domainQuery, range],
  );

  useEffect(() => {
    void refreshKeys();
  }, [refreshKeys, activeDomain]);

  async function copyKey(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  async function createKey() {
    if (!domain) {
      setKeysError("Add a domain before issuing keys");
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
    const name = key.label || key.domain;
    if (
      !window.confirm(
        `Rotate API key "${name}"? The current secret is revoked immediately and a new key is issued.`,
      )
    ) {
      return;
    }
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
      await refreshKeys(true);
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const showWorkerUnavailable = workerConnected === false && !loadingKeys;
  const canIssue = Boolean(domain) && workerConnected === true;
  const requestSeries = stats?.series.requests.map((b) => b.value) ?? [];
  const requestTotal = stats?.totals.requests ?? 0;
  const errorTotal = stats?.totals.errors ?? 0;

  const exampleApiKey =
    keys.find((key) => key.active && key.apiKey)?.apiKey ??
    keys.find((key) => key.apiKey)?.apiKey ??
    "YOUR_API_KEY";
  const exampleBaseUrl = workerUrl ?? "https://api.relaybase.xyz";
  const exampleFrom = domain ? `hello@${domain}` : "hello@yourdomain.com";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Issue and manage send keys
            {domain ? (
              <>
                {" "}
                for <span className="font-mono">{domain}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CurrentDomainSelect />
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open);
              if (!open) setLabel("");
            }}
          >
            <DialogTrigger>
              <Button size="sm" disabled={!canIssue}>
                <Plus className="size-4" />
                Issue key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Issue API key</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Keys are scoped to{" "}
                  <span className="font-mono">{domain}</span>.
                </p>
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
                  disabled={creating || !canIssue}
                >
                  {creating ? "Issuing…" : "Issue key"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshKeys(true)}
            disabled={refreshing || loadingKeys}
          >
            <RefreshCw
              className={cn(
                "size-4",
                (refreshing || loadingKeys) && "animate-spin",
              )}
            />
          </Button>
        </div>
      </div>

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

      {!domains.length && !loadingKeys ? (
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

      {domain && workerConnected !== false ? (
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
                  ? `${keys.length} key${keys.length === 1 ? "" : "s"} for ${domain}`
                  : `No keys yet for ${domain}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingKeys && !keys.length ? (
                <p className="text-sm text-muted-foreground">Loading keys…</p>
              ) : !keys.length ? (
                <div className="space-y-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    Issue a key to enable sending for this domain.
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
                                disabled={
                                  activatingId === key.id || !key.apiKey
                                }
                                onClick={() => void activateKey(key)}
                              >
                                {activatingId === key.id
                                  ? "Activating…"
                                  : "Use key"}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rotatingId === key.id}
                              onClick={() => void rotateKey(key)}
                            >
                              <RotateCw
                                className={cn(
                                  "mr-1 size-3.5",
                                  rotatingId === key.id && "animate-spin",
                                )}
                              />
                              {rotatingId === key.id ? "Rotating…" : "Rotate"}
                            </Button>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">How to send email</CardTitle>
              <CardDescription>
                Call <span className="font-mono">POST /v1/send</span> with your
                API key. <span className="font-mono">from</span> must be an
                address on{" "}
                <span className="font-mono">{domain || "yourdomain.com"}</span>
                .
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
                <span className="font-mono">{exampleBaseUrl}/v1/send</span>
                {exampleApiKey === "YOUR_API_KEY"
                  ? " · Replace YOUR_API_KEY with a key from the list above."
                  : " · Example uses your active key secret."}
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
