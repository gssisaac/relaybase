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
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";
import { campaignDetailHref } from "@/crm/lib/paths";
import { crmApi, CrmApiError, type Campaign } from "@/lib/crm/api";

function statsLine(c: Campaign): string {
  const subs = `${c.subscriberCount.toLocaleString()} subscriber${c.subscriberCount === 1 ? "" : "s"}`;
  const broadcasts = `${c.broadcastCount} broadcast${c.broadcastCount === 1 ? "" : "s"}`;
  return `${subs} · ${broadcasts}`;
}

export function CampaignsListView() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFromEmail, setNewFromEmail] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await crmApi.listCampaigns();
      setCampaigns(list.campaigns);
    } catch {
      toast.error("Could not load campaigns");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [campaigns, search]);

  function resetCreate() {
    setNewName("");
    setNewFromEmail("");
    setCreateError(null);
    setCreating(false);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) {
      setCreateError("Campaign name is required");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const campaign = await crmApi.createCampaign({
        name,
        fromEmail: newFromEmail.trim() || undefined,
      });
      toast.success(`Campaign '${campaign.name}' created`);
      setCreateOpen(false);
      resetCreate();
      router.push(campaignDetailHref(campaign.id, "subscribers"));
    } catch (err) {
      setCreateError(err instanceof CrmApiError ? err.message : "Could not create campaign");
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
                New campaign
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
            <h1 className="truncate text-lg font-semibold tracking-tight">Campaigns</h1>
            <p className="text-sm text-muted-foreground">
              Persistent newsletters and topic streams — the scope of subscriber consent
            </p>
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              A campaign is the consent scope for its subscribers. You can add broadcasts (individual
              sends) once it&apos;s created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Name</Label>
              <Input
                id="campaign-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Engineering Updates"
                autoComplete="off"
                autoFocus
              />
              {createError ? <p className="text-xs text-destructive">{createError}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-from-email">From email (optional)</Label>
              <Input
                id="campaign-from-email"
                type="email"
                value={newFromEmail}
                onChange={(e) => setNewFromEmail(e.target.value)}
                placeholder="newsletter@yourdomain.com"
                autoComplete="off"
              />
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
              disabled={creating || !newName.trim()}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create campaign"}
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
              searchPlaceholder="Search campaigns…"
            />
            {filtered.length > 0 ? (
              <>
                <EmailTableHeader>
                  <span>Campaign</span>
                  <span className="hidden sm:block">Stats</span>
                  <span className="hidden sm:block">Updated</span>
                  <span className="text-right">Status</span>
                </EmailTableHeader>
                <div>
                  {filtered.map((c) => (
                    <EmailTableRow
                      key={c.id}
                      href={campaignDetailHref(c.id)}
                      primary={c.name}
                      subject={statsLine(c)}
                      preview={c.fromEmail ?? undefined}
                      date={new Date(c.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      status={
                        <Badge
                          variant={c.status === "archived" ? "secondary" : "outline"}
                          className="text-[10px] capitalize"
                        >
                          {c.status}
                        </Badge>
                      }
                    />
                  ))}
                </div>
              </>
            ) : !loading ? (
              <EmptyListState
                icon={Mail}
                title="No campaigns yet"
                description="Create a campaign to start collecting subscribers and sending broadcasts."
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    New campaign
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
