"use client";

import Link from "next/link";
import {
  Activity,
  Check,
  Copy,
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { EmailAlerts } from "@/email/components/mailbox/EmailShared";
import { useDashboardPaths } from "@/console/lib/paths";
import { KeysStatusPanel } from "@/console/pages/keys/KeysStatusPanel";
import {
  dashboardCacheNeedsRefresh,
  loadApiKeysCache,
  saveApiKeysCache,
} from "@/lib/dashboard/dashboard-cache-disk";
import { useAccounts } from "@/lib/dashboard/AccountsContext";
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
import {
  desktopAwareFetch,
  isApiUnavailableError,
  readResponseJson,
  resolveEmailApiBase,
} from "@/lib/desktop/api";
import { useDesktopChrome } from "@/lib/desktop/shell";
import {
  forgetApiKey,
  loadApiKeyVaultEntries,
  mergeKeysWithVault,
  rememberApiKey,
} from "@/lib/desktop/vault";
import { cn } from "@/lib/utils";

type ProductEmailKeyRow = {
  id: string;
  domain: string;
  label: string | null;
  apiKey: string | null;
  active: boolean;
  createdAt: string;
};

type ApiKeysCacheData = {
  keys: ProductEmailKeyRow[];
  workerConnected: boolean;
};

type ExampleLang = "curl" | "javascript" | "python";
type KeysPageTab = "keys" | "status";

const KEYS_CACHE_KEY = "list";

const EXAMPLE_LANGS: { value: ExampleLang; label: string }[] = [
  { value: "curl", label: "cURL" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
];

const PAGE_TABS: { id: KeysPageTab; label: string; icon: typeof KeyRound }[] = [
  { id: "keys", label: "API Keys", icon: KeyRound },
  { id: "status", label: "Status", icon: Activity },
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
  const accounts = useAccounts();
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const readyDomains = useMemo(
    () =>
      domains.filter((d) => !d.onboarding || d.onboarding.status === "ready"),
    [domains],
  );

  const [tab, setTab] = useState<KeysPageTab>("keys");
  const [statusVisited, setStatusVisited] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [keys, setKeys] = useState<ProductEmailKeyRow[]>([]);
  const [workerConnected, setWorkerConnected] = useState<boolean | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
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
    setWorkerConnected(data.workerConnected);
  }, []);

  const refreshKeys = useCallback(
    async (force?: boolean) => {
      setKeysError(null);

      const cached = await loadApiKeysCache<ApiKeysCacheData>(KEYS_CACHE_KEY);
      if (cached && !force) {
        applyCacheData(cached.data);
        setLoadingKeys(false);
      } else if (!cached && !force) {
        setKeys([]);
      }

      const needsNetwork =
        force === true ||
        !cached ||
        dashboardCacheNeedsRefresh(cached.fetchedAt);

      if (!needsNetwork) return;

      if (cached) setRefreshing(true);
      else setLoadingKeys(true);

      try {
        const res = await desktopAwareFetch(`${apiBase}/keys`, {
          cache: "no-store",
        });
        const data = await readResponseJson<{
          keys?: ProductEmailKeyRow[];
          workerConnected?: boolean;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to load keys");
        const vault = await loadApiKeyVaultEntries();
        const merged = mergeKeysWithVault(
          (data.keys ?? []).map((k) => ({
            ...k,
            apiKey: k.apiKey ?? null,
          })),
          vault,
        );
        const next: ApiKeysCacheData = {
          keys: merged,
          workerConnected: data.workerConnected ?? true,
        };
        applyCacheData(next);
        await saveApiKeysCache(KEYS_CACHE_KEY, next);
      } catch (e) {
        if (!isApiUnavailableError(e)) {
          setKeysError(e instanceof Error ? e.message : "Failed to load keys");
        }
      } finally {
        setLoadingKeys(false);
        setRefreshing(false);
      }
    },
    [apiBase, applyCacheData],
  );

  useEffect(() => {
    void refreshKeys();
  }, [refreshKeys]);

  useEffect(() => {
    if (tab === "status") setStatusVisited(true);
  }, [tab]);

  useEffect(() => {
    if (!addOpen) return;
    setIssueDomain((current) => {
      if (current && readyDomains.some((d) => d.domain === current)) {
        return current;
      }
      const selected = keys.find((key) => key.id === selectedKeyId);
      if (
        selected?.domain &&
        readyDomains.some((d) => d.domain === selected.domain)
      ) {
        return selected.domain;
      }
      return readyDomains[0]?.domain ?? null;
    });
  }, [addOpen, keys, readyDomains, selectedKeyId]);

  useEffect(() => {
    setSelectedKeyId((current) => {
      if (current && keys.some((key) => key.id === current)) return current;
      return keys.find((key) => key.active)?.id ?? keys[0]?.id ?? null;
    });
  }, [keys]);

  const selectedKey = keys.find((key) => key.id === selectedKeyId) ?? null;
  const selectedDomain = selectedKey?.domain ?? null;

  useEffect(() => {
    if (!selectedDomain) return;
    void accounts.refresh(selectedDomain);
  }, [accounts, selectedDomain]);

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
      const res = await desktopAwareFetch(`${apiBase}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, label: label.trim() || undefined }),
      });
      const data = await readResponseJson<{
        domain?: string;
        label?: string | null;
        apiKey?: string;
        id?: string;
        error?: string;
        message?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      if (data.apiKey && data.id) {
        await rememberApiKey({
          id: data.id,
          domain: data.domain ?? domain,
          label: data.label,
          apiKey: data.apiKey,
        });
        await copyKey(data.id, data.apiKey);
      }
      setKeysMessage(
        data.message ??
          `Issued API key for ${data.domain}${data.label ? ` (${data.label})` : ""}`,
      );
      setLabel("");
      setAddOpen(false);
      if (data.id) setSelectedKeyId(data.id);
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
      const res = await desktopAwareFetch(`${apiBase}/keys/${key.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const data = await readResponseJson<{ error?: string; message?: string }>(
        res,
      );
      if (!res.ok) throw new Error(data.error ?? "Activate failed");
      setKeysMessage(data.message ?? `Using key for ${key.domain}`);
      setSelectedKeyId(key.id);
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
      const res = await desktopAwareFetch(`${apiBase}/keys/${key.id}/rotate`, {
        method: "POST",
      });
      const data = await readResponseJson<{
        apiKey?: string;
        id?: string;
        error?: string;
        message?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Rotate failed");
      setKeysMessage(data.message ?? `Rotated key for ${key.domain}`);
      if (data.apiKey && data.id) {
        await rememberApiKey({
          id: data.id,
          domain: key.domain,
          label: key.label,
          apiKey: data.apiKey,
        });
        await copyKey(data.id, data.apiKey);
        setKeysMessage(
          `${data.message ?? "Key rotated"} — new secret copied to clipboard`,
        );
      }
      setSelectedKeyId(key.id);
      await refreshKeys(true);
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
      const res = await desktopAwareFetch(
        `${apiBase}/keys/${encodeURIComponent(key.id)}`,
        { method: "DELETE" },
      );
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Revoke failed");
      await forgetApiKey(key.id);

      const nextKeys = keys.filter((entry) => entry.id !== key.id);
      setKeys(nextKeys);
      await saveApiKeysCache(KEYS_CACHE_KEY, {
        keys: nextKeys,
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

  function refreshPage() {
    setRefreshNonce((n) => n + 1);
    void refreshKeys(true);
  }

  const showWorkerUnavailable = workerConnected === false && !loadingKeys;
  const canIssue = readyDomains.length > 0 && workerConnected === true;

  const exampleApiKey = selectedKey?.apiKey ?? "YOUR_API_KEY";
  const exampleBaseUrl =
    resolveEmailApiBase() || "https://relaybase-api.gssisaac.worker.dev";
  const domainAddresses = selectedDomain
    ? accounts.addressesFor(selectedDomain)
    : [];
  const exampleFrom =
    domainAddresses[0]?.email ??
    (selectedDomain ? `hello@${selectedDomain}` : "youraccount@yourdomain.com");
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
        <DesktopTitleBar className="flex-col items-stretch gap-0 px-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold tracking-tight">
                API Keys
              </h1>
              <p className="text-sm text-muted-foreground">
                {tab === "status"
                  ? "Request volume and recent send activity."
                  : "Issue and manage send keys across your domains."}
              </p>
            </div>
            <div
              className={cn(
                "flex shrink-0 items-center gap-2",
                noDragClassName,
              )}
              {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
            >
              <DialogTrigger
                render={<Button size="sm" disabled={!canIssue} />}
              >
                <Plus className="size-4" />
                Issue key
              </DialogTrigger>
              <Button
                variant="outline"
                size="sm"
                aria-label="Refresh API keys"
                onClick={() => refreshPage()}
                disabled={refreshing}
              >
                <RefreshCw
                  className={cn("size-4", refreshing && "animate-spin")}
                />
              </Button>
            </div>
          </div>
          <nav
            className={cn(
              "flex gap-1 overflow-x-auto border-t border-border px-4 pb-2 pt-2",
              noDragClassName,
            )}
            aria-label="API keys"
            {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
          >
            {PAGE_TABS.map((item) => {
              const Icon = item.icon;
              const active = item.id === tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
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

          {workerConnected !== false && statusVisited ? (
            <div className={tab === "status" ? undefined : "hidden"}>
              <KeysStatusPanel apiBase={apiBase} refreshNonce={refreshNonce} />
            </div>
          ) : null}

          {workerConnected !== false && tab === "keys" ? (
            <>
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
                    <p className="text-sm text-muted-foreground">
                      Loading keys…
                    </p>
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
                        {keys.map((key) => {
                          const selected = key.id === selectedKeyId;
                          return (
                            <TableRow
                              key={key.id}
                              className={cn(
                                "cursor-pointer",
                                selected && "bg-muted/50",
                              )}
                              onClick={() => setSelectedKeyId(key.id)}
                            >
                              <TableCell className="font-mono text-xs">
                                {key.domain}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {key.label ?? "—"}
                              </TableCell>
                              <TableCell
                                className="min-w-[220px]"
                                onClick={(e) => e.stopPropagation()}
                              >
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
                              <TableCell
                                className="text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
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
                                        disabled={
                                          !key.apiKey ||
                                          activatingId === key.id
                                        }
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
                          );
                        })}
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
                    your API key. <span className="font-mono">from</span> must
                    be an address on{" "}
                    <span className="font-mono">
                      {selectedDomain ?? "your domain"}
                    </span>{" "}
                    (e.g. <span className="font-mono">{exampleFrom}</span>).
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
                  <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre text-foreground dark:bg-black/40">
                    {exampleCode}
                  </pre>
                  <p className="text-xs text-muted-foreground">
                    Endpoint:{" "}
                    <span className="font-mono">{exampleBaseUrl}/v1/send</span>
                    {exampleApiKey === "YOUR_API_KEY"
                      ? selectedDomain
                        ? ` · Issue a key for ${selectedDomain} to fill in the secret.`
                        : " · Replace YOUR_API_KEY with a key from the list above."
                      : ` · Example uses the ${selectedDomain ?? "selected"} key secret.`}
                  </p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
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
