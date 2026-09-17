"use client";

import { Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { SubscriberDataSourceGuide } from "@/studio/pages/subscribers/SubscriberDataSourceGuide";
import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import { useWorkerDomains } from "@/studio/lib/domains/use-worker-domains";
import { useSubscriberRoutes } from "@/studio/pages/subscribers/SubscriberRouteContext";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { dashboardScrollBodyClassName, DashboardTableScroll } from "@/console/lib/page-layout";
import { EmailAlerts } from "@/email/components/mailbox/EmailShared";
import { useVerifiedAccounts } from "@/studio/stores/verified-accounts";
import { VerifiedAccountsQuotaCard } from "@/studio/components/verified-accounts/VerifiedAccountsQuotaCard";
import {
  formatOverviewCompact,
  OverviewKpiCard,
} from "@/studio/pages/overview/OverviewKpiCard";
import type { SubscriberGroupSummary } from "@/email/components/mailbox/types";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { StudioApiError, studioSubscriberApi } from "@/studio/api";

import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { CredentialInput } from "@/components/ui/credential-input";
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

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | {
      status: "success";
      totalCount: number;
      skippedCount: number;
      sampleContacts: Array<{ email: string; name?: string }>;
    }
  | { status: "error"; message: string };

function lastSyncLabel(group: SubscriberGroupSummary): string {
  if (!group.dataSource) return "—";
  if (!group.lastSyncAt) return "Not synced yet";
  const when = new Date(group.lastSyncAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return group.lastSyncStatus === "error" ? `Failed · ${when}` : when;
}

function friendlyCrmError(e: unknown, fallback: string): string {
  if (e instanceof StudioApiError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}

export function SubscriberGroupsView() {
  const router = useRouter();
  const verifiedStore = useVerifiedAccounts();
  const { subscriberDetailHref } = useSubscriberRoutes();
  const {
    domains: workerDomains,
    loading: workerDomainsLoading,
    refresh: refreshWorkerDomains,
  } = useWorkerDomains();

  const [groups, setGroups] = useState<SubscriberGroupSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState<string | null>(null);
  const [useDataSource, setUseDataSource] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [credential, setCredential] = useState("");
  const [credentialHeader, setCredentialHeader] = useState("");
  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const [registering, setRegistering] = useState(false);
  const [emailsByGroupId, setEmailsByGroupId] = useState<Record<string, string[]>>({});
  const [emailsLoading, setEmailsLoading] = useState(false);

  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const refresh = useCallback(async (_force?: boolean) => {
    const hasData = groupsRef.current.length > 0;
    if (!hasData) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const result = await studioSubscriberApi.listGroups();
      setGroups(result.groups ?? []);
    } catch (e) {
      setError(friendlyCrmError(e, "Refresh failed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (groups.length === 0) {
      setEmailsByGroupId({});
      return;
    }
    let cancelled = false;
    setEmailsLoading(true);
    void (async () => {
      const entries = await Promise.all(
        groups.map(async (g) => {
          try {
            const detail = await studioSubscriberApi.getGroup(g.id);
            return [
              g.id,
              detail.contacts.map((c) => c.email.trim().toLowerCase()).filter(Boolean),
            ] as const;
          } catch {
            return [g.id, [] as string[]] as const;
          }
        }),
      );
      if (!cancelled) {
        setEmailsByGroupId(Object.fromEntries(entries));
        setEmailsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groups]);

  const allRecipientEmails = useMemo(() => {
    const unique = new Set<string>();
    for (const emails of Object.values(emailsByGroupId)) {
      for (const email of emails) unique.add(email);
    }
    return [...unique];
  }, [emailsByGroupId]);

  const globalRecipientCounts = useMemo(() => {
    if (allRecipientEmails.length > 0) {
      return verifiedStore.countsForEmails(allRecipientEmails);
    }
    const total = groups.reduce((sum, g) => sum + g.contactCount, 0);
    return { verified: 0, pending: 0, unverified: total, total };
  }, [allRecipientEmails, groups, verifiedStore, verifiedStore.lastRefreshedAt]);

  function verifiedFractionLabel(groupId: string, contactCount: number): string {
    const emails = emailsByGroupId[groupId];
    const total = emails?.length ?? contactCount;
    if (emailsLoading && !emails) return `—/${total}`;
    if (!emails || emails.length === 0) return `0/${total}`;
    const { verified } = verifiedStore.countsForEmails(emails);
    return `${verified}/${total}`;
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(
      (g) =>
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.domain.toLowerCase().includes(q),
    );
  }, [groups, search]);

  const createDomainOptions = useMemo(
    () =>
      [...workerDomains]
        .map((d) => ({
          value: d.domain,
          label: d.domain,
          disabled: Boolean(d.onboarding) && d.onboarding?.status !== "ready",
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [workerDomains],
  );

  function resetAddForm() {
    setName("");
    const firstReady =
      workerDomains.find((d) => !d.onboarding || d.onboarding.status === "ready")
        ?.domain ?? workerDomains[0]?.domain ?? null;
    setDomain(firstReady);
    setUseDataSource(false);
    setEndpointUrl("");
    setCredential("");
    setCredentialHeader("");
    setTestState({ status: "idle" });
  }

  async function testConnection() {
    setTestState({ status: "testing" });
    try {
      const data = await studioSubscriberApi.testConnection({
        endpointUrl,
        credential,
        credentialHeader,
      });
      if (!data.ok) {
        setTestState({
          status: "error",
          message: data.error ?? "Test failed",
        });
        return;
      }
      setTestState({
        status: "success",
        totalCount: data.totalCount ?? 0,
        skippedCount: data.skippedCount ?? 0,
        sampleContacts: data.sampleContacts ?? [],
      });
    } catch (e) {
      setTestState({
        status: "error",
        message: friendlyCrmError(e, "Test failed"),
      });
    }
  }

  async function registerGroup() {
    if (!name.trim() || !domain) return;
    setRegistering(true);
    setError(null);
    try {
      const workerUrl = resolveEmailApiBase();
      const data = await studioSubscriberApi.createGroup({
        name,
        domain,
        ...(workerUrl ? { workerUrl } : {}),
        dataSource: useDataSource
          ? {
              type: "generic_json",
              endpointUrl,
              credential: credential || undefined,
              credentialHeader: credentialHeader || undefined,
            }
          : undefined,
      });
      setAddOpen(false);
      setMessage(`Created "${data.group.name}"`);
      await refresh(true);
    } catch (e) {
      setError(friendlyCrmError(e, "Failed to create group"));
    } finally {
      setRegistering(false);
    }
  }

  const canRegister =
    name.trim().length > 0 &&
    Boolean(domain) &&
    (!useDataSource || testState.status === "success");

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (open) {
            void refreshWorkerDomains();
            resetAddForm();
          }
        }}
      >
        <DesktopTitleBar
          className="px-4 py-3"
          end={
            <>
              <DialogTrigger render={<Button size="sm" />}>
                <Plus className="size-4" />
                Add subscriber group
              </DialogTrigger>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void refresh(true);
                  void verifiedStore.refreshDestinations();
                }}
                disabled={refreshing || verifiedStore.loadingDestinations}
              >
                <RefreshCw
                  className={refreshing ? "size-4 animate-spin" : "size-4"}
                />
              </Button>
            </>
          }
        >
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Subscribers</h1>
            <p className="text-sm text-muted-foreground">
              Subscriber groups and Cloudflare verification. Verified addresses send
              without daily quota limits.
            </p>
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add subscriber group</DialogTitle>
            <DialogDescription>
              Choose a sending domain from your Worker, then optionally sync
              contacts from an external endpoint.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={examplePlaceholder("Newsletter subscribers")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-audience-group-domain" className="text-xs">
                Domain
              </Label>
              <CmdDropdown
                triggerId="add-audience-group-domain"
                triggerClassName="min-w-0"
                value={domain}
                options={createDomainOptions}
                placeholder="Select domain"
                searchPlaceholder="Search domains…"
                disabled={workerDomainsLoading && createDomainOptions.length === 0}
                onValueChange={(v) => setDomain(v ?? null)}
              />
              {workerDomainsLoading ? (
                <p className="text-xs text-muted-foreground">Loading domains from Worker…</p>
              ) : workerDomains.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No domains on your Worker — add one in Console → Domains.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Contact emails (e.g. mock @relaybase.email) are recipients only — not this
                  sending domain.
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Data source</Label>
                <Select
                  items={[
                    {
                      value: "manual",
                      label: "No data source (manual only)",
                    },
                    {
                      value: "generic_json",
                      label: "Generic JSON endpoint",
                    },
                  ]}
                  value={useDataSource ? "generic_json" : "manual"}
                  onValueChange={(v) => {
                    setUseDataSource(v === "generic_json");
                    setTestState({ status: "idle" });
                  }}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      No data source (manual only)
                    </SelectItem>
                    <SelectItem value="generic_json">
                      Generic JSON endpoint
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {useDataSource ? (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Endpoint URL</Label>
                    <Input
                      value={endpointUrl}
                      onChange={(e) => {
                        setEndpointUrl(e.target.value);
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
                        setTestState({ status: "idle" });
                      }}
                      placeholder="Paste your token"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Sent as{" "}
                      <span className="font-mono">
                        Authorization: Bearer &lt;token&gt;
                      </span>
                      . Use the eye icon to show or hide.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Header name (advanced)</Label>
                    <Input
                      value={credentialHeader}
                      onChange={(e) => {
                        setCredentialHeader(e.target.value);
                        setTestState({ status: "idle" });
                      }}
                      placeholder="Authorization"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={
                      !endpointUrl.trim() || testState.status === "testing"
                    }
                    onClick={testConnection}
                  >
                    {testState.status === "testing"
                      ? "Testing…"
                      : "Test connection"}
                  </Button>
                  {testState.status === "success" ? (
                    <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
                      <p className="font-medium text-foreground">
                        {testState.totalCount} contact
                        {testState.totalCount === 1 ? "" : "s"} found
                        {testState.skippedCount > 0
                          ? ` (${testState.skippedCount} skipped)`
                          : ""}
                      </p>
                      {testState.sampleContacts.length > 0 ? (
                        <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[11px] text-muted-foreground">
                          {testState.sampleContacts.slice(0, 5).map((c) => (
                            <li key={c.email} className="truncate">
                              {c.email}
                              {c.name ? ` — ${c.name}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : testState.status === "error" ? (
                    <p className="text-xs text-destructive">
                      {testState.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canRegister || registering}
              onClick={registerGroup}
            >
              {registering ? "Registering…" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <EmailAlerts
            error={error}
            message={message}
            onDismissError={() => setError(null)}
            onDismissMessage={() => setMessage(null)}
          />

          <VerifiedAccountsQuotaCard />

          {verifiedStore.destinationError ? (
            <p className="text-xs text-destructive">{verifiedStore.destinationError}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <OverviewKpiCard
              icon={ShieldCheck}
              label="Verified"
              value={formatOverviewCompact(globalRecipientCounts.verified)}
              hint={
                globalRecipientCounts.pending > 0
                  ? `${globalRecipientCounts.pending} pending verification`
                  : "Cloudflare destination addresses confirmed"
              }
            />
            <OverviewKpiCard
              icon={Users}
              label="Total subscribers"
              value={formatOverviewCompact(globalRecipientCounts.total)}
              hint={`${groups.length} group${groups.length === 1 ? "" : "s"} across your domains`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Subscriber groups</CardTitle>
              <CardDescription>
                {groups.length} group{groups.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search groups…"
                  className="h-8 max-w-xs"
                />
              </div>
              {filtered.length > 0 ? (
                <DashboardTableScroll minWidthClassName="min-w-[720px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9 text-xs font-normal text-muted-foreground">
                        Name
                      </TableHead>
                      <TableHead className="h-9 text-xs font-normal text-muted-foreground">
                        Domain
                      </TableHead>
                      <TableHead className="h-9 text-xs font-normal text-muted-foreground">
                        Contacts
                      </TableHead>
                      <TableHead className="h-9 text-xs font-normal text-muted-foreground">
                        Verified
                      </TableHead>
                      <TableHead className="h-9 text-xs font-normal text-muted-foreground">
                        Data source
                      </TableHead>
                      <TableHead className="h-9 text-xs font-normal text-muted-foreground">
                        Last sync
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((group) => (
                      <TableRow
                        key={group.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(subscriberDetailHref(group.id))
                        }
                      >
                        <TableCell className="font-medium">
                          {group.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {group.domain}
                        </TableCell>
                        <TableCell>{group.contactCount}</TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {verifiedFractionLabel(group.id, group.contactCount)}
                        </TableCell>
                        <TableCell>
                          {group.dataSource ? (
                            <Badge
                              variant={
                                group.lastSyncStatus === "error"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="text-[10px]"
                            >
                              {group.cronEnabled
                                ? "Synced · scheduled"
                                : "Synced"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Manual
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {lastSyncLabel(group)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </DashboardTableScroll>
              ) : !loading ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Users
                    className="size-8 text-muted-foreground"
                    aria-hidden
                  />
                  <p className="text-sm font-medium">No subscriber groups yet</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Create a group to start collecting subscribers manually, or
                    by syncing an external endpoint.
                  </p>
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="size-4" />
                    Add subscriber group
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
