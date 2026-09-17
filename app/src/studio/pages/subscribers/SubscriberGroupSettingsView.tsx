"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import { useWorkerDomains } from "@/studio/lib/domains/use-worker-domains";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useSubscriberRoutes } from "@/studio/pages/subscribers/SubscriberRouteContext";
import { StudioApiError, studioSubscriberApi } from "@/studio/api";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { SubscriberDataSourceGuide } from "@/studio/pages/subscribers/SubscriberDataSourceGuide";
import {
  clearSubscriberGroupDetailCache,
  useSubscriberGroupDetail,
} from "@/studio/pages/subscribers/SubscriberGroupDetailContext";
import { EmailAlerts } from "@/email/components/mailbox/EmailShared";

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

export function SubscriberGroupSettingsView() {
  const productId = useProductId();
  const { subscribersRoot } = useSubscriberRoutes();
  const router = useRouter();
  const { groupId, detail, refresh } = useSubscriberGroupDetail();
  const { domains, loading: domainsLoading, refresh: refreshWorkerDomains } =
    useWorkerDomains();

  const [name, setName] = useState("");
  const [groupDomain, setGroupDomain] = useState<string | null>(null);
  const [defaultFrom, setDefaultFrom] = useState<string | null>(null);
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

  useEffect(() => {
    void refreshWorkerDomains();
  }, [refreshWorkerDomains]);

  const domainOptions = useMemo(() => {
    const byName = new Map(
      domains.map((d) => [
        d.domain,
        {
          value: d.domain,
          label: d.domain,
          disabled:
            Boolean(d.onboarding) && d.onboarding?.status !== "ready",
        },
      ]),
    );
    const pinned = (groupDomain ?? detail?.group.domain)?.trim();
    if (pinned && !byName.has(pinned)) {
      byName.set(pinned, { value: pinned, label: pinned, disabled: false });
    }
    return [...byName.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [domains, groupDomain, detail?.group.domain]);

  useEffect(() => {
    if (!detail) return;
    const { group } = detail;
    setName(group.name);
    setGroupDomain(group.domain);
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
      const data = await studioSubscriberApi.testConnection({
        endpointUrl,
        groupId,
        ...(credential.trim() ? { credential: credential.trim() } : {}),
        credentialHeader,
      });
      if (!data.ok) {
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
        message:
          e instanceof StudioApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Test failed",
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

      if (!groupDomain) {
        setError("Select a sending domain");
        return;
      }
      const workerUrl = resolveEmailApiBase();
      await studioSubscriberApi.updateGroup(groupId, {
        name,
        domain: groupDomain,
        ...(workerUrl ? { workerUrl } : {}),
        defaultFrom: defaultFrom || null,
        cronEnabled,
        cronIntervalMinutes: Number(cronIntervalMinutes),
        ...(dataSourceEdited ? { dataSource: dataSourcePayload } : {}),
      });
      setMessage("Settings saved");
      setDataSourceEdited(false);
      if (credential.trim()) setHasStoredCredential(true);
      clearSubscriberGroupDetailCache(productId, groupId);
      await refresh(true);
    } catch (e) {
      setError(
        e instanceof StudioApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await studioSubscriberApi.deleteGroup(groupId);
      clearSubscriberGroupDetailCache(productId, groupId);
      router.push(subscribersRoot);
    } catch (e) {
      setError(
        e instanceof StudioApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to delete group",
      );
      setDeleting(false);
    }
  }

  // Only require a fresh successful test when the data source is enabled
  // and its fields were actually touched — pure name/cron edits, or leaving
  // an already-verified data source untouched, don't need re-testing.
  // Token can be left blank when one is already stored.
  const canSave =
    name.trim().length > 0 &&
    Boolean(groupDomain) &&
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
            <Label htmlFor="audience-group-domain" className="text-xs">
              Domain
            </Label>
            <CmdDropdown
              triggerId="audience-group-domain"
              triggerClassName="min-w-0"
              value={groupDomain}
              options={domainOptions}
              placeholder={
                domainsLoading ? "Loading domains…" : "Select sending domain"
              }
              searchPlaceholder="Search domains…"
              disabled={domainsLoading && domainOptions.length === 0}
              onValueChange={(next) => {
                if (!next) {
                  setGroupDomain(null);
                  return;
                }
                setGroupDomain(next);
                if (
                  defaultFrom &&
                  !defaultFrom.toLowerCase().endsWith(`@${next.toLowerCase()}`)
                ) {
                  setDefaultFrom(null);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Relaybase catalog, Cloudflare zones on your connected account, and Console
              senders/keys. Zones not yet added in Console → Domains may need onboarding before
              send. Subscriber contact addresses are unrelated.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="audience-group-default-sender" className="text-xs">
              Default sender
            </Label>
            <AccountCmdDropdown
              triggerId="audience-group-default-sender"
              triggerClassName="min-w-0"
              value={defaultFrom}
              domainFilter={groupDomain}
              pinnedEmails={defaultFrom ? [defaultFrom] : []}
              disabled={!groupDomain}
              placeholder={
                !groupDomain ? "Select a domain first" : "Select sender"
              }
              onValueChange={(email) => setDefaultFrom(email ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              From address on the selected domain when sending newsletters to this group.
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
                <SubscriberDataSourceGuide />
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
            Delete subscriber group
          </Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent className="sm:max-w-md" showCloseButton={!deleting}>
              <DialogHeader>
                <DialogTitle>Delete subscriber group</DialogTitle>
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
