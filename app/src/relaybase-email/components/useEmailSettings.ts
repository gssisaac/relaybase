"use client";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import {
  clearEmailCache,
  fetchEmailCached,
} from "@/relaybase-email/components/email-cached-fetch";
import { readEmailStale } from "@/relaybase-email/components/useEmailViewLoading";
import { cacheHintText } from "@/lib/dashboard/shared/cached-fetch";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DomainStatus, EmailConfig } from "@/relaybase-email/components/types";

export function useEmailSettings() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<EmailConfig>(productId, "config") === null &&
      readEmailStale<DomainStatus>(productId, "status") === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cacheHint, setCacheHint] = useState<string | null>(null);

  const [emailDomain, setEmailDomain] = useState("");
  const [emailZoneId, setEmailZoneId] = useState("");
  const [cfAccountId, setCfAccountId] = useState("");
  const [cfApiToken, setCfApiToken] = useState("");
  const [cfDnsToken, setCfDnsToken] = useState("");
  const [cfApiEmail, setCfApiEmail] = useState("");
  const [cfGlobalKey, setCfGlobalKey] = useState("");
  const [relaybaseApiKey, setRelaybaseApiKey] = useState("");
  const [relaybaseAdminToken, setRelaybaseAdminToken] = useState("");
  const [inboundR2BucketName, setInboundR2BucketName] = useState("");
  const [credentialSource, setCredentialSource] = useState<
    "integration" | "manual"
  >("integration");

  const dataRef = useRef({ config, status });
  dataRef.current = { config, status };

  const applyConfig = useCallback((s: EmailConfig) => {
    setConfig(s);
    setCredentialSource(s.credentialSource ?? "integration");
    setEmailDomain(s.emailDomain ?? s.domain ?? "");
    setEmailZoneId(s.emailZoneId ?? "");
    setCfAccountId(s.cloudflareAccountId ?? "");
    setCfApiToken(s.cloudflareApiToken ?? "");
    setCfDnsToken(s.cloudflareDnsApiToken ?? "");
    setCfApiEmail(s.cloudflareApiEmail ?? "");
    setCfGlobalKey(s.cloudflareGlobalApiKey ?? "");
    setRelaybaseApiKey(s.relaybaseApiKey ?? "");
    setRelaybaseAdminToken(s.relaybaseAdminToken ?? "");
    setInboundR2BucketName(s.inboundR2BucketName ?? "");
  }, []);

  const domainPayload = useCallback(
    () => ({
      emailDomain: emailDomain.trim() || undefined,
    }),
    [emailDomain],
  );

  useEffect(() => {
    const staleConfig = readEmailStale<EmailConfig>(productId, "config");
    if (staleConfig) applyConfig(staleConfig);
    const staleStatus = readEmailStale<DomainStatus>(productId, "status");
    if (staleStatus) setStatus(staleStatus);
    if (staleConfig || staleStatus) setLoading(false);
  }, [applyConfig, productId]);

  const refresh = useCallback(
    async (options?: { dns?: boolean; refresh?: boolean }) => {
      const hasData =
        dataRef.current.config !== null || dataRef.current.status !== null;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const force = options?.refresh;
        const statusUrl = options?.dns
          ? `${apiBase}/status?dns=1`
          : `${apiBase}/status`;
        const statusResource = options?.dns ? "status:dns" : "status";
        const [cfgResult, statusResult] = await Promise.all([
          fetchEmailCached<EmailConfig>(
            productId,
            "config",
            `${apiBase}/config`,
            {
              refresh: force,
              onUpdate: (data) => applyConfig(data),
            },
          ),
          fetchEmailCached<DomainStatus>(productId, statusResource, statusUrl, {
            refresh: force,
            onUpdate: (data) => setStatus(data),
          }),
        ]);
        applyConfig(cfgResult.data);
        setStatus(statusResult.data);
        const meta = cfgResult.meta.fromCache ? cfgResult.meta : statusResult.meta;
        setCacheHint(cacheHintText(meta.fromCache, meta.ageMinutes));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyConfig, apiBase, productId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveCredentialSource(source: "integration" | "manual") {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialSource: source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      applyConfig(data);
      setMessage(data.message ?? "Credential source updated");
      clearEmailCache(productId);
      await refresh({ refresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveDomainSettings() {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(domainPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      applyConfig(data);
      setMessage(data.message ?? "Domain settings saved");
      clearEmailCache(productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveRelaybaseAdminToken() {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relaybaseAdminToken: relaybaseAdminToken.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      applyConfig(data);
      setMessage(data.message ?? "Relaybase admin token saved");
      clearEmailCache(productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function connectDomain(mode: "sending" | "routing" | "all" = "all") {
    setConnecting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...domainPayload(), mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Connect failed");
      setStatus(data.status);
      setMessage(data.message ?? "Domain updated on Cloudflare");
      clearEmailCache(productId);
      await refresh({ dns: true, refresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setConnecting(false);
    }
  }

  async function connectSending() {
    return connectDomain("sending");
  }

  async function connectRouting() {
    return connectDomain("routing");
  }

  async function connectWorkerInbound() {
    setConnecting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/inbound-routing`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Worker routing failed");
      setMessage(
        data.message ??
          "Inbound addresses now route to Relaybase and store mail in R2",
      );
      clearEmailCache(productId);
      await refresh({ refresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Worker routing failed");
    } finally {
      setConnecting(false);
    }
  }

  const relaybaseOk = config?.relaybaseConfigured ?? false;
  const relaybaseAdminOk = config?.relaybaseAdminConfigured ?? false;
  const cloudflareOk = config?.cloudflareConfigured ?? false;
  const canConnect = cloudflareOk && Boolean(emailDomain.trim());

  return {
    config,
    status,
    loading,
    refreshing,
    connecting,
    saving,
    error,
    message,
    emailDomain,
    setEmailDomain,
    emailZoneId,
    setEmailZoneId,
    cfAccountId,
    setCfAccountId,
    cfApiToken,
    setCfApiToken,
    cfDnsToken,
    setCfDnsToken,
    cfApiEmail,
    setCfApiEmail,
    cfGlobalKey,
    setCfGlobalKey,
    relaybaseApiKey,
    setRelaybaseApiKey,
    relaybaseAdminToken,
    setRelaybaseAdminToken,
    inboundR2BucketName,
    setInboundR2BucketName,
    credentialSource,
    usesIntegrationCredentials:
      config?.usesIntegrationCredentials ?? credentialSource === "integration",
    refresh,
    saveCredentialSource,
    saveDomainSettings,
    saveRelaybaseAdminToken,
    connectDomain,
    connectSending,
    connectRouting,
    connectWorkerInbound,
    relaybaseOk,
    relaybaseAdminOk,
    cloudflareOk,
    canConnect,
    cacheHint,
  };
}

export type EmailSettingsState = ReturnType<
  typeof useEmailSettings
>;
