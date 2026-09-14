"use client";

import { Mail, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { crmAudienceApi } from "@/lib/crm/audience-api";
import type { AudienceGroupSummary } from "@/email/components/mailbox/types";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";
import { broadcastDetailHref } from "@/crm/lib/paths";
import { crmApi, CrmApiError, type Broadcast } from "@/lib/crm/api";

function statsLine(b: Broadcast): string {
  const audience = `${b.audienceActiveCount.toLocaleString()} active`;
  const send = b.status === "sent" ? "sent" : b.status;
  return `${audience} · ${send}`;
}

export function BroadcastsListView() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAudienceGroupId, setNewAudienceGroupId] = useState<string>("");
  const [audienceGroups, setAudienceGroups] = useState<AudienceGroupSummary[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await crmApi.listBroadcasts();
      setBroadcasts(list.broadcasts);
    } catch {
      toast.error("Could not load broadcasts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    setAudienceLoading(true);
    crmAudienceApi
      .listGroups()
      .then(({ groups }) => setAudienceGroups(groups))
      .catch(() => toast.error("Could not load audience groups"))
      .finally(() => setAudienceLoading(false));
  }, [createOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return broadcasts.filter(
      (b) => !q || b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q),
    );
  }, [broadcasts, search]);

  const audienceSelectItems = useMemo(
    () =>
      audienceGroups.map((g) => ({
        value: g.id,
        label: `${g.name} (${g.domain}) · ${g.contactCount} contacts`,
      })),
    [audienceGroups],
  );

  function resetCreate() {
    setNewName("");
    setNewAudienceGroupId("");
    setCreateError(null);
    setCreating(false);
  }

  async function handleCreate() {
    const name = newName.trim();
    const audienceGroupId = newAudienceGroupId.trim();
    if (!name) {
      setCreateError("Broadcast name is required");
      return;
    }
    if (!audienceGroupId) {
      setCreateError("Select an audience group");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await crmApi.createBroadcast({
        name,
        audienceGroupId,
      });
      toast.success(`Broadcast '${created.name}' created`);
      setCreateOpen(false);
      resetCreate();
      router.push(broadcastDetailHref(created.id, "audience"));
    } catch (err) {
      setCreateError(err instanceof CrmApiError ? err.message : "Could not create broadcast");
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreate();
        }}
      >
        <DesktopTitleBar
          className="px-4 py-3"
          end={
            <>
              <DialogTrigger
                render={<Button size="sm" />}
                onClick={() => {
                  resetCreate();
                }}
              >
                <Plus className="size-4" />
                New broadcast
              </DialogTrigger>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void load(true)}
                disabled={refreshing}
              >
                <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
              </Button>
            </>
          }
        >
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">Broadcasts</h1>
            <p className="text-sm text-muted-foreground">
              Email broadcasts with linked audience and send lifecycle
            </p>
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New broadcast</DialogTitle>
            <DialogDescription>
              Pick an audience group — members sync as send targets with unsubscribe tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-name">Name</Label>
              <Input
                id="broadcast-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Engineering Updates"
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-audience">Audience</Label>
              {audienceLoading ? (
                <p className="text-sm text-muted-foreground">Loading audience groups…</p>
              ) : audienceGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create an audience group first, then return here to start a broadcast.
                </p>
              ) : (
                <Select
                  items={audienceSelectItems}
                  value={newAudienceGroupId || null}
                  onValueChange={(value) => setNewAudienceGroupId(value ?? "")}
                >
                  <SelectTrigger id="broadcast-audience" className="w-full">
                    <SelectValue placeholder="Select audience group" />
                  </SelectTrigger>
                  <SelectContent>
                    {audienceGroups.map((g) => {
                      const label = `${g.name} (${g.domain}) · ${g.contactCount} contacts`;
                      return (
                        <SelectItem key={g.id} value={g.id} label={label}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {createError ? <p className="text-xs text-destructive">{createError}</p> : null}
            </div>
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
              disabled={creating || !newName.trim() || !newAudienceGroupId.trim()}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create broadcast"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <EmailListContainer>
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search broadcasts…"
            />
            {filtered.length > 0 ? (
              <>
                <EmailTableHeader>
                  <span>Broadcast</span>
                  <span className="hidden sm:block">Stats</span>
                  <span className="hidden sm:block">Updated</span>
                  <span className="text-right">Status</span>
                </EmailTableHeader>
                <div>
                  {filtered.map((b) => (
                    <EmailTableRow
                      key={b.id}
                      href={broadcastDetailHref(b.id)}
                      primary={b.name}
                      subject={statsLine(b)}
                      preview={b.audienceGroupName ?? b.fromEmail ?? undefined}
                      date={new Date(b.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      status={
                        <Badge
                          variant={b.listStatus === "archived" ? "secondary" : "outline"}
                          className="text-[10px] capitalize"
                        >
                          {b.listStatus}
                        </Badge>
                      }
                    />
                  ))}
                </div>
              </>
            ) : !loading ? (
              <EmptyListState
                icon={Mail}
                title="No broadcasts yet"
                description="Create a broadcast to sync an audience and send email."
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
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

/** @deprecated use BroadcastsListView */
export const CampaignsListView = BroadcastsListView;
