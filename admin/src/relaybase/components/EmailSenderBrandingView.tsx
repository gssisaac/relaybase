"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  useEmailSender,
  useEmailSenderCacheHint,
  RELAYBASE_CACHE_ID,
} from "@/relaybase/components/EmailSenderContext";
import { RELAYBASE_API } from "@/relaybase/components/constants";
import {
  EmailSenderAlerts,
  EmailSenderToolbar,
} from "@/relaybase/components/EmailSenderShared";
import { fetchCachedApi } from "@/lib/dashboard/shared/cached-fetch";
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

type BrandingStatus = {
  domain: string;
  zoneId: string | null;
  dnsConfigured: boolean;
  dnsCanApply: boolean;
  dnsApplyHint: string | null;
  settings: {
    dmarcPolicy: "none" | "quarantine" | "reject";
    dmarcRua: string;
    bimiLogoUrl: string;
  };
  dmarc: {
    name: string;
    expected: string;
    current: string | null;
    found: boolean;
  };
  bimi: {
    name: string;
    expected: string;
    current: string | null;
    found: boolean;
  };
  dmarcEnforced: boolean;
  bimiReady: boolean;
  notes: string[];
};

export function EmailSenderBrandingView() {
  const {
    config,
    keys,
    loading: ctxLoading,
    refreshing: ctxRefreshing,
    configMeta,
    keysMeta,
    refreshKeys,
  } = useEmailSender();
  const configured = Boolean(config?.configured);
  const domains = useMemo(
    () => [
      ...new Set(
        keys
          .map((key) => key.domain.trim().toLowerCase())
          .filter(Boolean),
      ),
    ],
    [keys],
  );
  const cacheHint = useEmailSenderCacheHint(configMeta, keysMeta);

  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<BrandingStatus | null>(null);
  const [dmarcPolicy, setDmarcPolicy] = useState<"none" | "quarantine" | "reject">(
    "quarantine",
  );
  const [dmarcRua, setDmarcRua] = useState("");
  const [bimiLogoUrl, setBimiLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeDomain = useMemo(() => domain.trim().toLowerCase(), [domain]);

  const loadBranding = useCallback(async (targetDomain: string, force?: boolean) => {
    const { data } = await fetchCachedApi<BrandingStatus>(
      RELAYBASE_CACHE_ID,
      "relaybase",
      `branding:${targetDomain}`,
      `${RELAYBASE_API}/branding?domain=${encodeURIComponent(targetDomain)}`,
      {
        refresh: force,
        onUpdate: (next) => {
          setStatus(next);
          setDmarcPolicy(next.settings.dmarcPolicy);
          setDmarcRua(next.settings.dmarcRua);
          setBimiLogoUrl(next.settings.bimiLogoUrl);
        },
      },
    );
    setStatus(data);
    setDmarcPolicy(data.settings.dmarcPolicy);
    setDmarcRua(data.settings.dmarcRua);
    setBimiLogoUrl(data.settings.bimiLogoUrl);
    return data;
  }, []);

  const refresh = useCallback(
    async (force?: boolean) => {
      setRefreshing(true);
      setError(null);
      try {
        if (force) await refreshKeys({ refresh: true });
        if (!configured) {
          setStatus(null);
          return;
        }
        const target = (domain || domains[0] || "").trim().toLowerCase();
        if (target) {
          if (!domain) setDomain(target);
          await loadBranding(target, force);
        } else {
          setStatus(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setRefreshing(false);
      }
    },
    [configured, domain, domains, loadBranding, refreshKeys],
  );

  useEffect(() => {
    if (!configured) return;
    if (!domain && domains[0]) setDomain(domains[0]);
  }, [configured, domain, domains]);

  useEffect(() => {
    if (!activeDomain || !configured) return;
    setLoading(true);
    void loadBranding(activeDomain)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load branding"),
      )
      .finally(() => setLoading(false));
  }, [activeDomain, configured, loadBranding]);

  async function onDomainChange(nextDomain: string) {
    setDomain(nextDomain);
    setLoading(true);
    setError(null);
    try {
      await loadBranding(nextDomain);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load domain");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!activeDomain) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${RELAYBASE_API}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: activeDomain,
          dmarcPolicy,
          dmarcRua,
          bimiLogoUrl,
        }),
      });
      const data = (await res.json()) as BrandingStatus & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setStatus(data);
      setMessage("Branding settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function applyDns(applyDmarc: boolean, applyBimi: boolean) {
    if (!activeDomain) return;
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${RELAYBASE_API}/branding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: activeDomain,
          applyDmarc,
          applyBimi,
        }),
      });
      const data = (await res.json()) as BrandingStatus & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setStatus(data);
      setMessage("DNS records applied in Cloudflare");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  const spinning = refreshing || ctxRefreshing || (ctxLoading && !config);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <EmailSenderToolbar
        refreshing={spinning}
        onRefresh={() => void refresh(true)}
        cacheHint={cacheHint}
      />
      <EmailSenderAlerts error={error} message={message} />

      {ctxLoading && !config ? (
        <p className="text-sm text-muted-foreground">Loading branding…</p>
      ) : null}

      {status && !status.dnsCanApply && status.dnsApplyHint ? (
        <Alert variant="destructive">
          <AlertTitle>DNS write access required</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{status.dnsApplyHint}</p>
            <p>
              Or add the BIMI record manually in{" "}
              <a
                href="https://dash.cloudflare.com"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Cloudflare DNS
              </a>
              : TXT name{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                default._bimi
              </code>
              , content{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {status.bimi.expected}
              </code>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {!configured ? (
        <Alert>
          <AlertTitle>Configure Relaybase first</AlertTitle>
          <AlertDescription>
            Set the worker URL and Cloudflare credentials in Settings before
            managing DMARC and BIMI.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sender branding (DMARC &amp; BIMI)</CardTitle>
          <CardDescription>
            Control the inbox display name prerequisites and brand logo via DNS.
            BIMI shows your logo in supporting mail clients once DMARC is enforced
            and the SVG logo is publicly reachable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1">
              <Label className="text-xs">Domain</Label>
              {domains.length > 0 ? (
                <Select
                  value={activeDomain}
                  onValueChange={(value) => {
                    if (value) void onDomainChange(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {entry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="macpurity.com"
                />
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
          </div>

          {activeDomain ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">DMARC policy</Label>
                  <Select
                    value={dmarcPolicy}
                    onValueChange={(value) =>
                      setDmarcPolicy(value as "none" | "quarantine" | "reject")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">p=none (monitor only)</SelectItem>
                      <SelectItem value="quarantine">p=quarantine</SelectItem>
                      <SelectItem value="reject">p=reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">DMARC report address</Label>
                  <Input
                    value={dmarcRua}
                    onChange={(e) => setDmarcRua(e.target.value)}
                    placeholder={`dmarc@${activeDomain}`}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">BIMI logo URL (HTTPS SVG)</Label>
                  <Input
                    value={bimiLogoUrl}
                    onChange={(e) => setBimiLogoUrl(e.target.value)}
                    placeholder={`https://${activeDomain}/bimi/logo.svg`}
                    className="font-mono text-xs"
                  />
                  {bimiLogoUrl ? (
                    <a
                      href={bimiLogoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Open logo URL
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void saveSettings()} disabled={saving}>
                  {saving ? "Saving…" : "Save branding settings"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void applyDns(true, true)}
                  disabled={applying || status?.dnsCanApply === false}
                >
                  {applying ? "Applying…" : "Apply DMARC + BIMI DNS"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void applyDns(false, true)}
                  disabled={applying || status?.dnsCanApply === false}
                >
                  Apply BIMI only
                </Button>
              </div>

              {status ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant={status.dmarcEnforced ? "default" : "secondary"}>
                    DMARC {status.dmarcEnforced ? "enforced" : "not enforced"}
                  </Badge>
                  <Badge variant={status.bimi.found ? "default" : "secondary"}>
                    BIMI {status.bimi.found ? "record found" : "missing"}
                  </Badge>
                  <Badge variant={status.bimiReady ? "default" : "secondary"}>
                    Logo ready {status.bimiReady ? "yes" : "no"}
                  </Badge>
                  {status.zoneId ? (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      zone {status.zoneId}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              {status ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[status.dmarc, status.bimi].map((record) => (
                      <TableRow key={record.name}>
                        <TableCell className="font-mono text-xs">
                          {record.name}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {record.expected}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {record.current ?? "—"}
                        </TableCell>
                        <TableCell>
                          {record.found ? (
                            <Badge variant="default">OK</Badge>
                          ) : (
                            <Badge variant="secondary">Missing</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}

              {status?.notes.length ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {status.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
