"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useEmailPaths } from "@/email/paths";
import { useDashboardPaths } from "@/dashboard/paths";
import { AudienceDataSourceGuide } from "@/dashboard/components/AudienceDataSourceGuide";
import {
  clearAudienceGroupDetailCache,
  useAudienceGroupDetail,
} from "@/dashboard/components/AudienceGroupDetailContext";
import { fetchEmailCachedOptional } from "@/email/components/email-cached-fetch";
import { readEmailStale } from "@/email/components/useEmailViewLoading";
import { EmailAlerts } from "@/email/components/EmailShared";
import type { Address } from "@/email/components/types";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  readResponseJson,
} from "@/lib/desktop/api-base";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CredentialInput } from "@/components/ui/credential-input";
import { FieldCheck } from "@/components/ui/field-check";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | {
      status: "success";
      totalCount: number;
      skippedCount: number;
    }
  | { status: "error"; message: string };

const DATA_SOURCE_OPTIONS = [
  { value: "manual", label: "No data source (manual only)" },
  { value: "generic_json", label: "Generic JSON endpoint" },
] as const;

const CRON_INTERVALS = [
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "1440", label: "Every day" },
];

export function AudienceGroupSettingsView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { audience } = useDashboardPaths();
  const router = useRouter();
  const { groupId, detail, refresh } = useAudienceGroupDetail();

  const [name, setName] = useState("");
  const [defaultFrom, setDefaultFrom] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [useDataSource, setUseDataSource] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [credential, setCredential] = useState("");
  const [credentialHeader, setCredentialHeader] = useState("");
  /** True when the group already has a stored token (field may be left blank). */
  const [hasStoredCredential, setHasStoredCredential] = useState(false);
  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const [dataSourceEdited, setDataSourceEdited] = useState(false);
  const [cronEnabled, setCronEnabled] = useState(false);
  const [cronIntervalMinutes, setCronIntervalMinutes] = useState("60");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const domainAddresses = useMemo(() => {
    const domain = detail?.group.domain;
    if (!domain) return [];
    return addresses.filter((a) => a.domain === domain);
  }, [addresses, detail?.group.domain]);

  useEffect(() => {
    const stale = readEmailStale<{ addresses?: Address[] }>(
      productId,
      "addresses:all",
    );
    if (stale) setAddresses(stale.addresses ?? []);
    void fetchEmailCachedOptional<{ addresses?: Address[] }>(
      productId,
      "addresses:all",
      `${apiBase}/addresses?all=1`,
      { onUpdate: (data) => setAddresses(data?.addresses ?? []) },
    ).then((r) => {
      if (r.ok) setAddresses(r.data?.addresses ?? []);
    });
  }, [apiBase, productId]);

  useEffect(() => {
    if (!detail) return;
    const { group } = detail;
    setName(group.name);
    setDefaultFrom(group.defaultFrom ?? null);
    setUseDataSource(Boolean(group.dataSource));
    setEndpointUrl(group.dataSource?.endpointUrl ?? "");
    setCredential(group.dataSource?.credential ?? "");
    setHasStoredCredential(Boolean(group.dataSource?.credential));
    setCredentialHeader(group.dataSource?.credentialHeader ?? "");
    setDataSourceEdited(false);
    setTestState({ status: "idle" });
    setCronEnabled(group.cronEnabled ?? false);
    setCronIntervalMinutes(String(group.cronIntervalMinutes ?? 60));
  }, [detail]);

  if (!detail) return null;

  async function testConnection() {
    setTestState({ status: "testing" });
    try {
      const res = await desktopAwareFetch(`${apiBase}/audience-groups/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointUrl,
          groupId,
          ...(credential.trim() ? { credential: credential.trim() } : {}),
          credentialHeader,
        }),
      });
      const data = await readResponseJson<{
        ok?: boolean;
        error?: string;
        totalCount?: number;
        skippedCount?: number;
      }>(res);
      if (!res.ok || !data.ok) {
        setTestState({ status: "error", message: data.error ?? "Test failed" });
        return;
      }
      setTestState({
        status: "success",
        totalCount: data.totalCount ?? 0,
        skippedCount: data.skippedCount ?? 0,
      });
    } catch (e) {
      setTestState({
        status: "error",
        message: friendlyDesktopFetchError(e, "Test failed"),
      });
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const dataSourcePayload = useDataSource
        ? {
            type: "generic_json" as const,
            endpointUrl,
            // Omit empty credential so the server keeps the stored token.
            ...(credential.trim() ? { credential: credential.trim() } : {}),
            credentialHeader,
          }
        : null;

      const res = await desktopAwareFetch(
        `${apiBase}/audience-groups/${encodeURIComponent(groupId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            defaultFrom: defaultFrom || null,
            cronEnabled,
            cronIntervalMinutes: Number(cronIntervalMinutes),
            ...(dataSourceEdited ? { dataSource: dataSourcePayload } : {}),
          }),
        },
      );
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to save settings");
      setMessage("Settings saved");
      setDataSourceEdited(false);
      if (credential.trim()) setHasStoredCredential(true);
      clearAudienceGroupDetailCache(productId, groupId);
      await refresh(true);
    } catch (e) {
      setError(friendlyDesktopFetchError(e, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await desktopAwareFetch(
        `${apiBase}/audience-groups/${encodeURIComponent(groupId)}`,
        { method: "DELETE" },
      );
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to delete group");
      clearAudienceGroupDetailCache(productId, groupId);
      router.push(audience);
    } catch (e) {
      setError(friendlyDesktopFetchError(e, "Failed to delete group"));
      setDeleting(false);
    }
  }

  // Only require a fresh successful test when the data source is enabled
  // and its fields were actually touched — pure name/cron edits, or leaving
  // an already-verified data source untouched, don't need re-testing.
  // Token can be left blank when one is already stored.
  const canSave =
    name.trim().length > 0 &&
    (!useDataSource ||
      !dataSourceEdited ||
      (testState.status === "success" &&
        (Boolean(credential.trim()) || hasStoredCredential)));

  return (
    <div className="space-y-4">
      <EmailAlerts
        error={error}
        message={message}
        onDismissError={() => setError(null)}
        onDismissMessage={() => setMessage(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Default sender</Label>
            <Select
              value={defaultFrom}
              onValueChange={(v) => setDefaultFrom(v)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent>
                {domainAddresses.map((a) => (
                  <SelectItem key={a.email} value={a.email}>
                    {a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used as the From address when sending broadcasts from this group.
              {domainAddresses.length === 0
                ? " Add a sender on this domain in Accounts first."
                : null}
            </p>
          </div>
          <Button size="sm" disabled={!canSave || saving} onClick={save}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Data source</CardTitle>
          <CardDescription>
            Optional external endpoint that contacts sync from.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            items={DATA_SOURCE_OPTIONS}
            value={useDataSource ? "generic_json" : "manual"}
            onValueChange={(v) => {
              setUseDataSource(v === "generic_json");
              setDataSourceEdited(true);
              setTestState({ status: "idle" });
            }}
          >
            <SelectTrigger className="h-9 w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {useDataSource ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Endpoint URL</Label>
                <Input
                  value={endpointUrl}
                  onChange={(e) => {
                    setEndpointUrl(e.target.value);
                    setDataSourceEdited(true);
                    setTestState({ status: "idle" });
                  }}
                  placeholder="https://api.example.com/contacts"
                />
                <AudienceDataSourceGuide />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">API key / token</Label>
                <CredentialInput
                  value={credential}
                  onChange={(e) => {
                    setCredential(e.target.value);
                    setDataSourceEdited(true);
                    setTestState({ status: "idle" });
                  }}
                  placeholder="Paste your token"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Sent as{" "}
                  <span className="font-mono">
                    Authorization: Bearer &lt;token&gt;
                  </span>
                  . Use the eye icon to show or hide the token.
                  {hasStoredCredential
                    ? " Clearing the field and saving keeps the previous token."
                    : " Paste the token here (not in Header name)."}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Header name (advanced)</Label>
                <Input
                  value={credentialHeader}
                  onChange={(e) => {
                    setCredentialHeader(e.target.value);
                    setDataSourceEdited(true);
                    setTestState({ status: "idle" });
                  }}
                  placeholder="Authorization"
                />
                <p className="text-xs text-muted-foreground">
                  Only change this if your API expects a different header name
                  (e.g. <span className="font-mono">X-API-Key</span>). Put the
                  secret in the token field above — not here.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!endpointUrl.trim() || testState.status === "testing"}
                onClick={testConnection}
              >
                {testState.status === "testing" ? "Testing…" : "Test connection"}
              </Button>
              {testState.status === "success" ? (
                <p className="text-xs text-muted-foreground">
                  {testState.totalCount} contacts found
                  {testState.skippedCount > 0
                    ? ` (${testState.skippedCount} skipped)`
                    : ""}
                </p>
              ) : testState.status === "error" ? (
                <p className="text-xs text-destructive">{testState.message}</p>
              ) : null}

              <div className="space-y-2 border-t border-border/60 pt-3">
                <FieldCheck
                  id="cron-enabled"
                  checked={cronEnabled}
                  onCheckedChange={setCronEnabled}
                  label="Scheduled background refresh"
                  description="Also refresh automatically on a schedule, in addition to manual refresh."
                />
                {cronEnabled ? (
                  <Select
                    items={CRON_INTERVALS}
                    value={cronIntervalMinutes}
                    onValueChange={(v) => v && setCronIntervalMinutes(v)}
                  >
                    <SelectTrigger className="h-9 w-[280px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_INTERVALS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            </div>
          ) : null}

          <Button size="sm" disabled={!canSave || saving} onClick={save}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-destructive">
            Delete group
          </CardTitle>
          <CardDescription>
            Removes this group and its contacts. Broadcast history is kept but
            loses the reference to this group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            Delete audience group
          </Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent className="sm:max-w-md" showCloseButton={!deleting}>
              <DialogHeader>
                <DialogTitle>Delete audience group</DialogTitle>
                <DialogDescription>
                  Delete{" "}
                  <span className="font-medium text-foreground">
                    {detail.group.name}
                  </span>
                  ? This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={confirmDelete}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
