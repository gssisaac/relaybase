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
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";
import { campaignDetailHref } from "@/crm/lib/paths";
import { crmApi, type Campaign, type CrmTemplate } from "@/lib/crm/api";

const STATUS_VARIANT: Record<
  Campaign["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "secondary",
  sent: "default",
  failed: "destructive",
};

function statsLine(c: Campaign): string {
  if (c.status === "sent" || c.stats.sent > 0) {
    return `${c.stats.sent} sent · ${c.stats.opened} opened`;
  }
  if (c.status === "scheduled" && c.scheduledAt) {
    return `Scheduled ${new Date(c.scheduledAt).toLocaleString()}`;
  }
  return c.status;
}

export function CampaignsListView() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<CrmTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newTemplateId, setNewTemplateId] = useState("");

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const [list, t] = await Promise.all([crmApi.listCampaigns(), crmApi.listTemplates()]);
      setCampaigns(list.campaigns);
      setTemplates(t.templates);
      setNewTemplateId((prev) => prev || t.templates[0]?.id || "");
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

  const templateById = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        !q ||
        (c.subject || "").toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q),
    );
  }, [campaigns, search]);

  function resetCreate() {
    setNewSubject("");
    setNewTemplateId(templates[0]?.id ?? "");
    setCreating(false);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const campaign = await crmApi.createCampaign({
        subject: newSubject.trim() || undefined,
        templateId: newTemplateId || undefined,
      });
      setCreateOpen(false);
      resetCreate();
      router.push(campaignDetailHref(campaign.id));
    } catch {
      toast.error("Could not create campaign");
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
              Draft and send campaigns to your CRM contacts
            </p>
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Optionally set a subject and template. You can change both while composing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-subject">Subject</Label>
              <Input
                id="campaign-subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Untitled draft"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-template">Template</Label>
              <Select
                items={templates.map((t) => ({ value: t.id, label: t.name }))}
                value={newTemplateId || null}
                onValueChange={(next) => {
                  if (next) setNewTemplateId(next);
                }}
              >
                <SelectTrigger id="campaign-template" className="w-full">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={creating}
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
                  <span>Subject</span>
                  <span className="hidden sm:block">Stats</span>
                  <span className="hidden sm:block">Date</span>
                  <span className="text-right">Status</span>
                </EmailTableHeader>
                <div>
                  {filtered.map((c) => (
                    <EmailTableRow
                      key={c.id}
                      href={campaignDetailHref(c.id)}
                      primary={c.subject?.trim() || "Untitled draft"}
                      subject={statsLine(c)}
                      preview={
                        c.templateId
                          ? templateById.get(c.templateId)?.name ?? undefined
                          : undefined
                      }
                      date={new Date(c.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      status={
                        <Badge
                          variant={STATUS_VARIANT[c.status]}
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
                description="Create a draft and write your first campaign."
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
