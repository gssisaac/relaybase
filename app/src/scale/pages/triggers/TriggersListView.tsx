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
import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { TriggerStatusBadge } from "@/scale/components/triggers/TriggerStatusBadge";
import {
  triggerListRelativeDate,
  triggerStatsLine,
  triggerSourceSummary,
} from "@/scale/lib/triggers/trigger-label";
import {
  replaceTriggerSidebarList,
  upsertTriggerSidebarListRow,
} from "@/scale/lib/triggers/trigger-sidebar-list";
import { triggerDetailHref } from "@/scale/lib/paths";
import { TriggersOverviewTopSection } from "@/scale/pages/triggers/TriggersOverviewTopSection";
import {
  scaleApi,
  ScaleApiError,
  type Trigger,
  type TriggerPurpose,
  type TriggerStatus,
  type ScaleOverview,
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

type TriggerFilter = "all" | TriggerStatus;

const FILTER_OPTIONS: { value: TriggerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "draft", label: "Draft" },
];

export function TriggersListView() {
  const router = useRouter();
  const [rows, setRows] = useState<Trigger[]>([]);
  const [overview, setOverview] = useState<ScaleOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TriggerFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSenderEmail, setNewSenderEmail] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState<string | null>(null);
  const [newPurpose, setNewPurpose] = useState<TriggerPurpose>("transactional");

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else {
      setLoading(true);
      setOverviewLoading(true);
    }
    const [listResult, overviewResult] = await Promise.allSettled([
      scaleApi.listTriggers(),
      scaleApi.getOverview(),
    ]);

    if (listResult.status === "fulfilled") {
      setRows(listResult.value.triggers);
      replaceTriggerSidebarList(listResult.value.triggers);
    } else {
      toast.error("Could not load triggers");
    }

    if (overviewResult.status === "fulfilled") {
      setOverview(overviewResult.value);
    } else if (!force) {
      toast.error("Could not load overview stats — is hq/scale running on port 32831?");
    }

    setLoading(false);
    setOverviewLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetCreate() {
    setNewName("");
    setNewSenderEmail(null);
    setNewDomain(null);
    setNewPurpose("transactional");
    setCreating(false);
  }

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
          triggerSourceSummary(r.source).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rows, search, filter]);

  async function handleCreate() {
    const name = newName.trim();
    const domain = newDomain?.trim().toLowerCase();
    if (!name || !domain) {
      toast.error("Name and sending account are required");
      return;
    }
    setCreating(true);
    try {
      const created = await scaleApi.createTrigger({ name, domain, purpose: newPurpose });
      upsertTriggerSidebarListRow(created);
      toast.success(`Trigger '${created.name}' created`);
      setCreateOpen(false);
      resetCreate();
      router.push(triggerDetailHref(created.id, "preview", created.status));
    } catch (e) {
      toast.error(e instanceof ScaleApiError ? e.message : "Could not create trigger");
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
                Add trigger
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
            <h1 className="truncate text-lg font-semibold tracking-tight">Triggers</h1>
            <p className="text-sm text-muted-foreground">Send email when something happens</p>
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add trigger</DialogTitle>
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
              <CmdDropdown
                triggerClassName="min-w-0"
                value={newPurpose}
                enableSearch={false}
                options={[
                  { value: "transactional", label: "Transactional" },
                  { value: "conversational", label: "Conversational" },
                  { value: "marketing", label: "Marketing" },
                ]}
                onValueChange={(v) => {
                  if (v === "transactional" || v === "conversational" || v === "marketing") {
                    setNewPurpose(v);
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trigger-create-sender">Sending account</Label>
              <AccountCmdDropdown
                triggerId="trigger-create-sender"
                triggerClassName="min-w-0"
                value={newSenderEmail}
                onValueChange={(email, ctx) => {
                  setNewSenderEmail(email ?? null);
                  setNewDomain(ctx?.domain ?? null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Sending domain is taken from the account you pick.
              </p>
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
              disabled={creating || !newName.trim() || !newDomain?.trim()}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("flex flex-col gap-4")}>
          {overviewLoading && !overview ? (
            <p className="text-sm text-muted-foreground">Loading stats…</p>
          ) : null}
          {overview ? (
            <TriggersOverviewTopSection
              data={overview}
              filter={filter}
              onFilterChange={setFilter}
            />
          ) : null}

          <EmailListContainer>
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search triggers…"
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
                  <span>Trigger</span>
                  <span className="hidden sm:block">Stats</span>
                  <span className="hidden sm:block">Updated</span>
                  <span className="text-right">Status</span>
                </EmailTableHeader>
                <div>
                  {filtered.map((row) => (
                    <EmailTableRow
                      key={row.id}
                      href={triggerDetailHref(row.id, undefined, row.status)}
                      primary={row.name}
                      subject={triggerStatsLine(row)}
                      preview={triggerSourceSummary(row.source)}
                      date={triggerListRelativeDate(row)}
                      status={
                        <TriggerStatusBadge
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
                  title="No triggers yet"
                  description="Create an trigger for verify email, contact forms, or inbox replies."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        resetCreate();
                        setCreateOpen(true);
                      }}
                    >
                      Add trigger
                    </Button>
                  }
                />
              ) : (
                <EmptyListState
                  icon={Zap}
                  title="No matching triggers"
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
