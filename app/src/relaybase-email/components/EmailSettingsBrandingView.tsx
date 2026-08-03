"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearEmailCache,
  fetchEmailCached,
  fetchEmailCachedOptional,
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
import type { Address } from "@/relaybase-email/components/types";
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

type BrandingUserStatus =
  | "not_set"
  | "setting_up"
  | "needs_verification"
  | "ready";

type BrandingStatus = {
  domain: string;
  dnsCanApply: boolean;
  dnsApplyHint: string | null;
  logoStoredLocally?: boolean;
  hasVerificationFile: boolean;
  userStatus: BrandingUserStatus;
  userMessage: string;
};

const STATUS_LABEL: Record<BrandingUserStatus, string> = {
  not_set: "Logo not set",
  setting_up: "Setting up…",
  needs_verification: "Needs verification for Gmail",
  ready: "Inbox logo ready",
};

export function EmailSettingsBrandingView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const emailSettings = useEmailSettings();
  const [status, setStatus] = useState<BrandingStatus | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showVerifyUpload, setShowVerifyUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cacheHint, setCacheHint] = useState<string | null>(null);
  const [logoVersion, setLogoVersion] = useState(0);

  const statusRef = useRef(status);
  statusRef.current = status;

  const domain = useMemo(
    () =>
      (
        emailSettings.emailDomain ||
        emailSettings.config?.emailDomain ||
        ""
      ).trim().toLowerCase(),
    [emailSettings.config?.emailDomain, emailSettings.emailDomain],
  );

  const loadBranding = useCallback(
    async (targetDomain: string, force?: boolean) => {
      const { data, meta } = await fetchEmailCached<BrandingStatus>(
        productId,
        `branding:${targetDomain}`,
        `${apiBase}/branding?domain=${encodeURIComponent(targetDomain)}`,
        { refresh: force, onUpdate: (d) => setStatus(d) },
      );
      setStatus(data);
      setCacheHint(cacheHintText(meta.fromCache, meta.ageMinutes));
      return data;
    },
    [apiBase, productId],
  );

  useEffect(() => {
    if (!domain) return;
    const staleStatus = readEmailStale<BrandingStatus>(
      productId,
      `branding:${domain}`,
    );
    if (staleStatus) {
      setStatus(staleStatus);
      setLoading(false);
    }
    const staleAddresses = readEmailStale<{ addresses?: Address[] }>(
      productId,
      `addresses:${domain}`,
    );
    if (staleAddresses) setAddresses(staleAddresses.addresses ?? []);
  }, [domain, productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      if (!domain) {
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
        const [, addrResult] = await Promise.all([
          loadBranding(domain, force),
          fetchEmailCachedOptional<{ addresses?: Address[] }>(
            productId,
            `addresses:${domain}`,
            `${apiBase}/addresses?domain=${encodeURIComponent(domain)}`,
            { refresh: force, onUpdate: (d) => setAddresses(d?.addresses ?? []) },
          ),
        ]);
        if (addrResult.ok) setAddresses(addrResult.data?.addresses ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, domain, loadBranding, productId],
  );

  useEffect(() => {
    if (emailSettings.loading && !domain) return;
    void refresh();
  }, [domain, emailSettings.loading, refresh]);

  async function uploadLogo(file: File | null) {
    if (!domain || !file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("domain", domain);
      form.set("file", file);
      const res = await fetch(`${apiBase}/branding/logo`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as BrandingStatus & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setStatus(data);
      setLogoVersion((v) => v + 1);
      clearEmailCache(productId, `branding:${domain}`);
      setMessage("Logo updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function uploadVerification(file: File | null) {
    if (!domain || !file) return;
    setVerifying(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("domain", domain);
      form.set("file", file);
      const res = await fetch(`${apiBase}/branding/verification`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as BrandingStatus & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setStatus(data);
      clearEmailCache(productId, `branding:${domain}`);
      setMessage("Verification saved");
      setShowVerifyUpload(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setVerifying(false);
    }
  }

  const previewName = useMemo(() => {
    const withName = addresses.find((a) => a.displayName?.trim());
    return withName?.displayName?.trim() || domain || "Your business";
  }, [addresses, domain]);

  const initial = previewName.trim().charAt(0).toUpperCase() || "?";
  const logoSrc =
    status?.logoStoredLocally && domain
      ? `${apiBase}/branding/logo?domain=${encodeURIComponent(domain)}&v=${logoVersion}`
      : null;

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
        <Alert>
          <AlertTitle>We can&apos;t finish setup automatically yet</AlertTitle>
          <AlertDescription>{status.dnsApplyHint}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inbox logo</CardTitle>
          <CardDescription>
            Upload once and every address on{" "}
            <span className="font-medium text-foreground">
              {domain || "your domain"}
            </span>{" "}
            will show this logo in the recipient&apos;s inbox. Sender names
            are set under Accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-lg font-semibold text-muted-foreground">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt="Logo preview"
                  className="size-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {previewName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  2:14 PM
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                This is how your emails will look in the inbox
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs" htmlFor="branding-logo-upload">
              Upload logo
            </Label>
            <Input
              id="branding-logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="h-10 cursor-pointer text-xs"
              disabled={uploading || !domain}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void uploadLogo(file);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPG, or SVG. A square image works best.
              {uploading ? " Uploading…" : ""}
            </p>
          </div>

          {status ? (
            <div className="space-y-1.5">
              <Badge variant={status.userStatus === "ready" ? "default" : "secondary"}>
                {STATUS_LABEL[status.userStatus]}
              </Badge>
              <p className="text-sm text-muted-foreground">{status.userMessage}</p>
            </div>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : null}

          {status?.userStatus === "needs_verification" ? (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">
                Gmail shows your logo after a one-time brand check. Once that
                check is approved, upload the verification file you received
                to finish.
              </p>
              {!showVerifyUpload ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowVerifyUpload(true)}
                >
                  Verify logo for Gmail
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs" htmlFor="branding-verification-upload">
                    Upload verification file
                  </Label>
                  <Input
                    id="branding-verification-upload"
                    type="file"
                    className="h-10 cursor-pointer text-xs"
                    disabled={verifying}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      void uploadVerification(file);
                      e.target.value = "";
                    }}
                  />
                  {verifying ? (
                    <p className="text-xs text-muted-foreground">Saving…</p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
