"use client";

import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearEmailCache,
  fetchEmailCached,
} from "@/relaybase-email/components/email-cached-fetch";
import {
  CloudflareConfigAlert,
  EmailAlerts,
  PageToolbar,
} from "@/relaybase-email/components/EmailShared";
import { readEmailStale } from "@/relaybase-email/components/useEmailViewLoading";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { useEmailSettings } from "@/relaybase-email/components/useEmailSettings";
import { cacheHintText } from "@/lib/dashboard/shared/cached-fetch";
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

export function EmailSettingsBrandingView() {
  const productId = useProductId();
  const { apiBase, settingsCloudflare, settingsDomain } = useEmailPaths();
  const emailSettings = useEmailSettings();
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<BrandingStatus | null>(null);
  const [dmarcPolicy, setDmarcPolicy] = useState<"none" | "quarantine" | "reject">(
    "quarantine",
  );
  const [dmarcRua, setDmarcRua] = useState("");
  const [bimiLogoUrl, setBimiLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cacheHint, setCacheHint] = useState<string | null>(null);

  const statusRef = useRef(status);
  statusRef.current = status;

  const configuredDomain = useMemo(
    () =>
      (
        emailSettings.emailDomain ||
        emailSettings.config?.emailDomain ||
        ""
      ).trim().toLowerCase(),
    [emailSettings.config?.emailDomain, emailSettings.emailDomain],
  );

  const activeDomain = useMemo(
    () => (domain || configuredDomain).trim().toLowerCase(),
    [configuredDomain, domain],
  );

  const loadBranding = useCallback(
    async (targetDomain: string, force?: boolean) => {
      const { data, meta } = await fetchEmailCached<BrandingStatus>(
        productId,
        `branding:${targetDomain}`,
        `${apiBase}/branding?domain=${encodeURIComponent(targetDomain)}`,
        {
          refresh: force,
          onUpdate: (d) => {
            setStatus(d);
            setDmarcPolicy(d.settings.dmarcPolicy);
            setDmarcRua(d.settings.dmarcRua);
            setBimiLogoUrl(d.settings.bimiLogoUrl);
          },
        },
      );
      setStatus(data);
      setDmarcPolicy(data.settings.dmarcPolicy);
      setDmarcRua(data.settings.dmarcRua);
      setBimiLogoUrl(data.settings.bimiLogoUrl);
      setCacheHint(cacheHintText(meta.fromCache, meta.ageMinutes));
      return data;
    },
    [apiBase, productId],
  );

  useEffect(() => {
    const target = configuredDomain;
    if (!target) return;
    const stale = readEmailStale<BrandingStatus>(productId, `branding:${target}`);
    if (stale) {
      setDomain(target);
      setStatus(stale);
      setDmarcPolicy(stale.settings.dmarcPolicy);
      setDmarcRua(stale.settings.dmarcRua);
      setBimiLogoUrl(stale.settings.bimiLogoUrl);
      setLoading(false);
    }
  }, [configuredDomain, productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      const target = (domain || configuredDomain).trim().toLowerCase();
      if (!target) {
        setStatus(null);
        setCacheHint(null);
        setLoading(false);
        return;
      }
      const hasData = statusRef.current !== null;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        if (!domain) setDomain(target);
        await loadBranding(target, force);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [configuredDomain, domain, loadBranding],
  );

  useEffect(() => {
    if (emailSettings.loading && !configuredDomain) return;
    void refresh();
  }, [configuredDomain, emailSettings.loading, refresh]);

  async function saveSettings() {
    if (!activeDomain) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/branding`, {
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
      clearEmailCache(productId, `branding:${activeDomain}`);
      setMessage("Branding settings saved");
      await loadBranding(activeDomain, true);
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
      const res = await fetch(`${apiBase}/branding`, {
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
      clearEmailCache(productId, `branding:${activeDomain}`);
      setMessage("DNS records applied in Cloudflare");
      await loadBranding(activeDomain, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex-none space-y-4 overflow-visible">
      <PageToolbar
        refreshing={refreshing || emailSettings.refreshing}
        cacheHint={cacheHint}
        onRefresh={() => refresh(true)}
      />
      <EmailAlerts error={error ?? emailSettings.error} message={message} />
      <CloudflareConfigAlert show={!emailSettings.cloudflareOk} />

      {status && !status.dnsCanApply && status.dnsApplyHint ? (
        <Alert variant="destructive">
          <AlertTitle>DNS write access required</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{status.dnsApplyHint}</p>
            <p>
              Update credentials in{" "}
              <Link href={settingsDomain} className="underline">
                Domain connection
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {!emailSettings.cloudflareOk ? (
        <Alert>
          <AlertTitle>Configure Cloudflare Email first</AlertTitle>
          <AlertDescription>
            Set Cloudflare credentials in{" "}
            <Link href={settingsCloudflare} className="font-medium underline">
              Cloudflare settings
            </Link>{" "}
            and connect your domain in{" "}
            <Link href={settingsDomain} className="font-medium underline">
              Domain connection
            </Link>{" "}
            before managing DMARC and BIMI.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sender branding (DMARC &amp; BIMI)</CardTitle>
          <CardDescription>
            Control inbox display prerequisites and brand logo via DNS. BIMI shows
            your logo in supporting mail clients once DMARC is enforced and the SVG
            logo is publicly reachable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1">
              <Label className="text-xs">Domain</Label>
              {configuredDomain ? (
                <Input value={activeDomain} readOnly className="font-mono text-xs" />
              ) : (
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                />
              )}
            </div>
            {!configuredDomain ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refresh(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`mr-1.5 size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Load
              </Button>
            ) : null}
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
