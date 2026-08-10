"use client";

import { Plus, RefreshCw, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { AudienceDataSourceGuide } from "@/dashboard/components/AudienceDataSourceGuide";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { useEmailPaths } from "@/email/paths";
import {
  clearEmailCache,
  fetchEmailCached,
} from "@/email/components/email-cached-fetch";
import { readEmailStale } from "@/email/components/useEmailViewLoading";
import { EmailAlerts } from "@/email/components/EmailShared";
import type { AudienceGroupSummary } from "@/email/components/types";
import { isPackagedApiUnavailableError } from "@/lib/desktop/api-base";

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

const RESOURCE = "audience-groups";

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

function lastSyncLabel(group: AudienceGroupSummary): string {
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

export function AudienceGroupsView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const router = useRouter();
  const { domains } = useDomain();
  const readyDomains = useMemo(
    () =>
      domains.filter((d) => !d.onboarding || d.onboarding.status === "ready"),
    [domains],
  );

  const [groups, setGroups] = useState<AudienceGroupSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<{ groups?: AudienceGroupSummary[] }>(
        productId,
        RESOURCE,
      ) === null,
  );
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

  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  useEffect(() => {
    const stale = readEmailStale<{ groups?: AudienceGroupSummary[] }>(
      productId,
      RESOURCE,
    );
    if (stale) {
      setGroups(stale.groups ?? []);
      setLoading(false);
    }
  }, [productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      const hasData = groupsRef.current.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const result = await fetchEmailCached<{
          groups?: AudienceGroupSummary[];
        }>(productId, RESOURCE, `${apiBase}/audience-groups`, {
          refresh: force,
          onUpdate: (data) => setGroups(data.groups ?? []),
        });
        setGroups(result.data.groups ?? []);
      } catch (e) {
        setError(
          isPackagedApiUnavailableError(e)
            ? null
            : e instanceof Error
              ? e.message
              : "Refresh failed",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, productId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(
      (g) =>
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.domain.toLowerCase().includes(q),
    );
  }, [groups, search]);

  function resetAddForm() {
    setName("");
    setDomain(readyDomains[0]?.domain ?? null);
    setUseDataSource(false);
    setEndpointUrl("");
    setCredential("");
    setCredentialHeader("");
    setTestState({ status: "idle" });
  }

  async function testConnection() {
    setTestState({ status: "testing" });
    try {
      const res = await fetch(`${apiBase}/audience-groups/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointUrl, credential, credentialHeader }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
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
        message: e instanceof Error ? e.message : "Test failed",
      });
    }
  }

  async function registerGroup() {
    if (!name.trim() || !domain) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/audience-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domain,
          dataSource: useDataSource
            ? {
                type: "generic_json",
                endpointUrl,
                credential: credential || undefined,
                credentialHeader: credentialHeader || undefined,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create group");
      setAddOpen(false);
      setMessage(`Created "${data.group.name}"`);
      clearEmailCache(productId, RESOURCE);
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create group");
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
          if (open) resetAddForm();
        }}
      >
        <DesktopTitleBar
          className="px-4 py-3"
          end={
            <>
              <DialogTrigger render={<Button size="sm" />}>
                <Plus className="size-4" />
                Add audience group
              </DialogTrigger>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh(true)}
                disabled={refreshing}
              >
                <RefreshCw
                  className={refreshing ? "size-4 animate-spin" : "size-4"}
                />
              </Button>
            </>
          }
        >
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Audience</h1>
            <p className="text-sm text-muted-foreground">
              Groups of subscribers, optionally synced from an external data
              source.
            </p>
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add audience group</DialogTitle>
            <DialogDescription>
              Groups belong to a domain and can optionally sync contacts from
              an external endpoint.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Newsletter subscribers"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Domain</Label>
              <Select value={domain} onValueChange={(v) => v && setDomain(v)}>
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
                    <AudienceDataSourceGuide />
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
        <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
          <EmailAlerts
            error={error}
            message={message}
            onDismissError={() => setError(null)}
            onDismissMessage={() => setMessage(null)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Audience groups</CardTitle>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Contacts</TableHead>
                      <TableHead>Data source</TableHead>
                      <TableHead>Last sync</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((group) => (
                      <TableRow
                        key={group.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(
                            `/audience/${encodeURIComponent(group.id)}`,
                          )
                        }
                      >
                        <TableCell className="font-medium">
                          {group.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {group.domain}
                        </TableCell>
                        <TableCell>{group.contactCount}</TableCell>
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
              ) : !loading ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Users
                    className="size-8 text-muted-foreground"
                    aria-hidden
                  />
                  <p className="text-sm font-medium">No audience groups yet</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Create a group to start collecting subscribers manually, or
                    by syncing an external endpoint.
                  </p>
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="size-4" />
                    Add audience group
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
