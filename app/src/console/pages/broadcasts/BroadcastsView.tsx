"use client";

import { Megaphone, Plus, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { BroadcastBetaNotice } from "@/console/pages/broadcasts/BroadcastBetaNotice";
import { BroadcastDetailProvider } from "@/console/pages/broadcasts/BroadcastDetailContext";
import { BroadcastDetailSwitch } from "@/console/pages/broadcasts/BroadcastDetailSwitch";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import {
  broadcastDetailFromSearch,
  broadcastDetailHref,
  useDashboardPaths,
} from "@/console/lib/paths";
import { useEmailPaths } from "@/email/lib/paths";
import {
  fetchEmailCached,
  fetchEmailCachedOptional,
} from "@/email/components/mailbox/email-cached-fetch";
import { readEmailStale } from "@/email/components/mailbox/useEmailViewLoading";
import { EmailAlerts } from "@/email/components/mailbox/EmailShared";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  isPackagedApiUnavailableError,
  readResponseJson,
} from "@/lib/desktop/api";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";
import type {
  AudienceGroupSummary,
  EmailBroadcast,
} from "@/email/components/mailbox/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldCheck } from "@/components/ui/field-check";

const RESOURCE = "broadcasts:all";

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" {
  if (status === "sent") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function BroadcastsViewInner() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { broadcasts: broadcastsHref, audience } = useDashboardPaths();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [broadcasts, setBroadcasts] = useState<EmailBroadcast[]>([]);
  const [groups, setGroups] = useState<AudienceGroupSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<{ broadcasts?: EmailBroadcast[] }>(
        productId,
        RESOURCE,
      ) === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const broadcastsRef = useRef(broadcasts);
  broadcastsRef.current = broadcasts;

  useEffect(() => {
    const staleBroadcasts = readEmailStale<{ broadcasts?: EmailBroadcast[] }>(
      productId,
      RESOURCE,
    );
    if (staleBroadcasts) setBroadcasts(staleBroadcasts.broadcasts ?? []);
    const staleGroups = readEmailStale<{ groups?: AudienceGroupSummary[] }>(
      productId,
      "audience-groups",
    );
    if (staleGroups) setGroups(staleGroups.groups ?? []);
    if (staleBroadcasts) setLoading(false);
  }, [productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      const hasData = broadcastsRef.current.length > 0;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const [bcResult, groupsResult] = await Promise.all([
          fetchEmailCached<{ broadcasts?: EmailBroadcast[] }>(
            productId,
            RESOURCE,
            `${apiBase}/broadcasts`,
            {
              refresh: force,
              onUpdate: (data) => setBroadcasts(data.broadcasts ?? []),
            },
          ),
          fetchEmailCachedOptional<{ groups?: AudienceGroupSummary[] }>(
            productId,
            "audience-groups",
            `${apiBase}/audience-groups`,
            {
              refresh: force,
              onUpdate: (data) => setGroups(data?.groups ?? []),
            },
          ),
        ]);
        setBroadcasts(bcResult.data.broadcasts ?? []);
        if (groupsResult.ok) setGroups(groupsResult.data?.groups ?? []);
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
    void refresh();
  }, [refresh]);

  // Deep-link from Audience Send: /broadcasts?new=1&groupId=…
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const groupId = searchParams.get("groupId")?.trim();
    setSelectedGroupIds(groupId ? [groupId] : []);
    setCreateError(null);
    setCreateOpen(true);
    router.replace(broadcastsHref);
  }, [broadcastsHref, router, searchParams]);

  const groupById = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return broadcasts.filter(
      (b) =>
        !q ||
        (b.subject || "").toLowerCase().includes(q) ||
        (b.from || "").toLowerCase().includes(q),
    );
  }, [broadcasts, search]);

  const recipientCount = useMemo(() => {
    const selected = new Set(selectedGroupIds);
    return groups
      .filter((g) => selected.has(g.id))
      .reduce((sum, g) => sum + g.contactCount, 0);
  }, [groups, selectedGroupIds]);

  function openCreate() {
    setSelectedGroupIds([]);
    setCreateError(null);
    setCreateOpen(true);
  }

  function toggleGroup(groupId: string, checked: boolean) {
    setSelectedGroupIds((prev) =>
      checked
        ? Array.from(new Set([...prev, groupId]))
        : prev.filter((id) => id !== groupId),
    );
  }

  async function createBroadcast() {
    if (selectedGroupIds.length === 0) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await desktopAwareFetch(`${apiBase}/broadcasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupIds: selectedGroupIds,
          status: "draft",
        }),
      });
      const data = await readResponseJson<{
        broadcast: { id: string };
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to create broadcast");
      setCreateOpen(false);
      router.push(broadcastDetailHref(data.broadcast.id));
    } catch (e) {
      setCreateError(
        friendlyDesktopFetchError(e, "Failed to create broadcast"),
      );
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateError(null);
            setCreating(false);
          }
        }}
      >
        <DesktopTitleBar
          className="px-4 py-3"
          end={
            <>
              <DialogTrigger
                render={<Button size="sm" />}
                onClick={() => {
                  setSelectedGroupIds([]);
                  setCreateError(null);
                }}
              >
                <Megaphone className="size-4" />
                New broadcast
              </DialogTrigger>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refresh(true)}
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
            <h1 className="truncate text-lg font-semibold tracking-tight">
              Broadcasts
            </h1>
            <p className="text-sm text-muted-foreground">
              Draft and send broadcasts across your audience groups
            </p>
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New broadcast</DialogTitle>
            <DialogDescription>
              Choose the audience for this broadcast.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Audience</p>
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-0"
                nativeButton={false}
                render={<Link href={audience} />}
              >
                <Plus className="size-3" />
                New audience
              </Button>
            </div>

            {groups.length > 0 ? (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border/60 p-2.5">
                {groups.map((group) => (
                  <FieldCheck
                    key={group.id}
                    id={`broadcast-create-group-${group.id}`}
                    checked={selectedGroupIds.includes(group.id)}
                    onCheckedChange={(checked) =>
                      toggleGroup(group.id, checked)
                    }
                    label={
                      <span>
                        {group.name}{" "}
                        <span className="text-muted-foreground">
                          · {group.domain} · {group.contactCount} contacts
                        </span>
                      </span>
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 px-4 py-6 text-center">
                <Users className="mx-auto mb-2 size-7 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  No audience groups yet.
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={audience} />}
                >
                  <Plus className="size-4" />
                  New audience
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {recipientCount} contact{recipientCount === 1 ? "" : "s"} across
              selected groups
            </p>

            {createError ? (
              <p className="text-xs text-destructive">{createError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedGroupIds.length === 0 || creating}
              onClick={() => void createBroadcast()}
            >
              {creating ? "Creating…" : "Create broadcast"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
          <EmailAlerts
            error={error}
            message={null}
            onDismissError={() => setError(null)}
          />
          <BroadcastBetaNotice />

          <EmailListContainer>
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search broadcasts…"
            />
            {filtered.length > 0 ? (
              <>
                <EmailTableHeader>
                  <span>Subject</span>
                  <span className="hidden sm:block">Groups</span>
                  <span className="hidden sm:block">Date</span>
                  <span className="text-right">Status</span>
                </EmailTableHeader>
                <div>
                  {filtered.map((b) => (
                    <EmailTableRow
                      key={b.id}
                      href={broadcastDetailHref(b.id)}
                      primary={b.subject?.trim() || "Untitled draft"}
                      subject={b.groupIds
                        .map((id) => groupById.get(id)?.name ?? id)
                        .join(", ")}
                      preview={b.from ? `From ${b.from}` : "Draft"}
                      date={new Date(
                        b.sentAt ?? b.createdAt,
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      status={
                        <Badge
                          variant={statusVariant(b.status)}
                          className="text-[10px] capitalize"
                        >
                          {b.status}
                        </Badge>
                      }
                    />
                  ))}
                </div>
              </>
            ) : !loading ? (
              <EmptyListState
                icon={Megaphone}
                title="No broadcasts yet"
                description="Pick an audience and draft a broadcast."
                action={
                  <Button size="sm" onClick={openCreate}>
                    New broadcast
                  </Button>
                }
              />
            ) : (
              <div className="min-h-[200px]" />
            )}
          </EmailListContainer>
        </div>
      </div>
    </div>
  );
}

function BroadcastsRoute() {
  const searchParams = useSearchParams();
  const detail = broadcastDetailFromSearch(searchParams);
  if (detail) {
    return (
      <BroadcastDetailProvider
        key={detail.broadcastId}
        broadcastId={detail.broadcastId}
      >
        <BroadcastDetailSwitch tab={detail.tab} />
      </BroadcastDetailProvider>
    );
  }
  return <BroadcastsViewInner />;
}

export function BroadcastsView() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <BroadcastsRoute />
    </Suspense>
  );
}
