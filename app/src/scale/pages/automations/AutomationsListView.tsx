"use client";

import { Plus, RefreshCw, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
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
import { AutomationStatusBadge } from "@/scale/components/AutomationStatusBadge";
import { automationStatsLine, automationTriggerSummary } from "@/scale/lib/automation-trigger-label";
import { automationDetailHref } from "@/scale/lib/paths";
import { useWorkerDomains } from "@/scale/lib/use-worker-domains";
import {
  scaleApi,
  ScaleApiError,
  type Automation,
  type AutomationPurpose,
  type AutomationStatus,
} from "@/lib/scale/api";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { cn } from "@/lib/utils";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";

type AutomationFilter = "all" | AutomationStatus;

const FILTER_OPTIONS: { value: AutomationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "draft", label: "Draft" },
];

export function AutomationsListView() {
  const router = useRouter();
  const { readyDomains, loading: domainsLoading, refresh: refreshWorkerDomains } =
    useWorkerDomains();
  const [rows, setRows] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AutomationFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState<string | null>(null);
  const [newPurpose, setNewPurpose] = useState<AutomationPurpose>("transactional");

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await scaleApi.listAutomations();
      setRows(list.automations);
    } catch {
      toast.error("Could not load automations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetCreate() {
    setNewName("");
    setNewDomain(readyDomains[0]?.domain ?? null);
    setNewPurpose("transactional");
    setCreating(false);
  }

  useEffect(() => {
    if (!createOpen) return;
    void refreshWorkerDomains();
    resetCreate();
  }, [createOpen, refreshWorkerDomains]);

  const counts = useMemo(() => {
    const visible = rows.filter((r) => r.listStatus !== "archived");
    return {
      all: visible.length,
      active: visible.filter((r) => r.status === "active").length,
      paused: visible.filter((r) => r.status === "paused").length,
      draft: visible.filter((r) => r.status === "draft").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => r.listStatus !== "archived")
      .filter((r) => (filter === "all" ? true : r.status === filter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.slug.includes(q) ||
          automationTriggerSummary(r.trigger).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rows, search, filter]);

  async function handleCreate() {
    const name = newName.trim();
    const domain = newDomain?.trim().toLowerCase();
    if (!name || !domain) {
      toast.error("Name and domain are required");
      return;
    }
    setCreating(true);
    try {
      const created = await scaleApi.createAutomation({ name, domain, purpose: newPurpose });
      toast.success(`Automation '${created.name}' created`);
      setCreateOpen(false);
      resetCreate();
      router.push(automationDetailHref(created.id, "content", created.status));
    } catch (e) {
      toast.error(e instanceof ScaleApiError ? e.message : "Could not create automation");
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) resetCreate();
        }}
      >
        <DesktopTitleBar
          className="px-4 py-3"
          end={
            <>
              <DialogTrigger
                render={<Button size="sm" />}
                onClick={() => resetCreate()}
              >
                <Plus className="size-4" />
                Add automation
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
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">Automations</h1>
            <p className="text-sm text-muted-foreground">Send email when something happens</p>
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add automation</DialogTitle>
            <DialogDescription>
              One trigger, one email — verify links, form replies, or inbox auto-responses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auto-name">Name</Label>
              <Input
                id="auto-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={examplePlaceholder("Verify Email")}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Select
                value={newPurpose}
                onValueChange={(v) => setNewPurpose(v as AutomationPurpose)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Domain</Label>
              <Select value={newDomain} onValueChange={setNewDomain}>
                <SelectTrigger className="w-full">
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
              {domainsLoading ? (
                <p className="text-xs text-muted-foreground">Loading domains…</p>
              ) : null}
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
              disabled={creating || !newName.trim() || !newDomain}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create"}
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
              searchPlaceholder="Search automations…"
              trailing={
                <div className="inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-muted p-0.5">
                  {FILTER_OPTIONS.map((opt) => {
                    const count = counts[opt.value];
                    const isSelected = filter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFilter(opt.value)}
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
                          isSelected
                            ? "bg-background font-medium text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span>{opt.label}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground/70">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              }
            />
            {filtered.length > 0 ? (
              <>
                <EmailTableHeader>
                  <span>Automation</span>
                  <span className="hidden sm:block">Stats</span>
                  <span className="hidden sm:block">Updated</span>
                  <span className="text-right">Status</span>
                </EmailTableHeader>
                <div>
                  {filtered.map((row) => (
                    <EmailTableRow
                      key={row.id}
                      href={automationDetailHref(row.id, undefined, row.status)}
                      primary={row.name}
                      subject={automationStatsLine(row)}
                      preview={automationTriggerSummary(row.trigger)}
                      date={
                        row.lastSentAt
                          ? new Date(row.lastSentAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : new Date(row.updatedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                      }
                      status={
                        <AutomationStatusBadge
                          status={row.status}
                          listStatus={row.listStatus}
                        />
                      }
                    />
                  ))}
                </div>
              </>
            ) : !loading ? (
              rows.filter((r) => r.listStatus !== "archived").length === 0 ? (
                <EmptyListState
                  icon={Zap}
                  title="No automations yet"
                  description="Create an automation for verify email, contact forms, or inbox replies."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        resetCreate();
                        setCreateOpen(true);
                      }}
                    >
                      Add automation
                    </Button>
                  }
                />
              ) : (
                <EmptyListState
                  icon={Zap}
                  title="No matching automations"
                  description="Try a different filter or search term."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setFilter("all");
                      }}
                    >
                      Reset filters
                    </Button>
                  }
                />
              )
            ) : (
              <div className="min-h-[200px]" />
            )}
          </EmailListContainer>
        </div>
      </div>
    </div>
  );
}
