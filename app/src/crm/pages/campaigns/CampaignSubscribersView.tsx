"use client";

import { Plus, RefreshCw, Trash2, Upload, Users } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmApi, CrmApiError, type Subscriber, type SubscriberStatus } from "@/lib/crm/api";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<SubscriberStatus, string> = {
  subscribed: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  unsubscribed: "border-border bg-muted text-muted-foreground",
  pending: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bounced: "border-destructive/30 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: SubscriberStatus }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLE[status])}>
      {status}
    </Badge>
  );
}

function parseCsv(text: string): Array<{ email: string; name?: string }> {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };

  const header = parseLine(lines[0]!).map((h) => h.toLowerCase());
  const emailIdx = header.indexOf("email");
  if (emailIdx < 0) return [];
  const nameIdx = header.indexOf("name");

  const rows: Array<{ email: string; name?: string }> = [];
  for (const line of lines.slice(1)) {
    const cells = parseLine(line);
    const email = cells[emailIdx]?.trim();
    if (!email) continue;
    rows.push({ email, name: nameIdx >= 0 ? cells[nameIdx]?.trim() || undefined : undefined });
  }
  return rows;
}

export function CampaignSubscribersView() {
  const { campaignId, campaign, subscribers, refreshSubscribers, refresh } = useCampaignDetail();

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resubscribeConfirm, setResubscribeConfirm] = useState<{
    email: string;
    unsubscribedAt: string | null;
  } | null>(null);
  const [suppressedError, setSuppressedError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [syncing, setSyncing] = useState(false);

  if (!campaign) return null;

  function resetAdd() {
    setAddEmail("");
    setAddName("");
    setAddError(null);
    setAdding(false);
  }

  async function submitAdd(resubscribe?: boolean) {
    const email = addEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      setAddError("Enter a valid email address");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await crmApi.addSubscriber(campaignId, { email, name: addName.trim() || undefined, resubscribe });
      toast.success(`Added ${email} to subscribers`);
      setAddOpen(false);
      setResubscribeConfirm(null);
      resetAdd();
      await refreshSubscribers();
    } catch (err) {
      if (err instanceof CrmApiError) {
        const body = err.body as {
          suppressed?: boolean;
          requiresResubscribeConfirmation?: boolean;
          unsubscribedAt?: string | null;
        } | null;
        if (body?.suppressed) {
          setSuppressedError(err.message);
          setAdding(false);
          return;
        }
        if (body?.requiresResubscribeConfirmation) {
          setResubscribeConfirm({ email, unsubscribedAt: body.unsubscribedAt ?? null });
          setAdding(false);
          return;
        }
        setAddError(err.message);
      } else {
        setAddError("Could not add subscriber");
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(subscriber: Subscriber) {
    try {
      await crmApi.removeSubscriber(campaignId, subscriber.id);
      toast.success(`Removed ${subscriber.email}`);
      await refreshSubscribers();
    } catch {
      toast.error("Could not remove subscriber");
    }
  }

  async function handleUnsubscribe(subscriber: Subscriber) {
    try {
      await crmApi.updateSubscriber(campaignId, subscriber.id, { status: "unsubscribed" });
      toast.success(`${subscriber.email} unsubscribed`);
      await refreshSubscribers();
    } catch {
      toast.error("Could not update subscriber");
    }
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("Missing required 'email' column header. Check your CSV format.");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await crmApi.importSubscribers(campaignId, rows);
      setImportResult(result);
      toast.success(`Import finished: ${result.added} subscribers enrolled`);
      await refreshSubscribers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await crmApi.syncSubscribers(campaignId);
      toast.success(`Sync finished: ${result.added} added, ${result.updated} updated`);
      await Promise.all([refreshSubscribers(), refresh()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const subscribedCount = subscribers.filter((s) => s.status === "subscribed").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Subscribers</h2>
          <p className="text-xs text-muted-foreground">
            {subscribedCount.toLocaleString()} active subscriber{subscribedCount === 1 ? "" : "s"} in this
            campaign.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.dataSource?.endpointUrl ? (
            <Button size="sm" variant="outline" onClick={() => void handleSync()} disabled={syncing}>
              <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
              Sync now
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add subscriber
          </Button>
        </div>
      </div>

      {subscribers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No subscribers yet</p>
            <p className="text-xs text-muted-foreground">
              Add subscribers manually, import a CSV, or connect a data source in Settings.
            </p>
            <Button size="sm" className="mt-2" onClick={() => setAddOpen(true)}>
              Add subscriber
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {subscribers.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name || s.email}</p>
                  {s.name ? <p className="truncate text-xs text-muted-foreground">{s.email}</p> : null}
                  {s.status === "bounced" && s.bounceReason ? (
                    <p className="truncate text-xs text-destructive" title={s.bounceReason}>
                      {s.bounceReason}
                    </p>
                  ) : null}
                </div>
                <span className="hidden shrink-0 text-xs capitalize text-muted-foreground sm:inline">
                  {s.source}
                </span>
                <StatusBadge status={s.status} />
                <div className="flex shrink-0 items-center gap-1">
                  {s.status === "subscribed" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void handleUnsubscribe(s)}
                    >
                      Unsubscribe
                    </Button>
                  ) : null}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove subscriber"
                    onClick={() => void handleRemove(s)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add subscriber — UC-S1 */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetAdd();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add subscriber</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="subscriber-email">Email</Label>
              <Input
                id="subscriber-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="alex@example.com"
                autoComplete="off"
              />
              {addError ? <p className="text-xs text-destructive">{addError}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subscriber-name">Name (optional)</Label>
              <Input
                id="subscriber-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Alex"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void submitAdd()} disabled={adding || !addEmail.includes("@")}>
              {adding ? "Adding…" : "Add subscriber"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resubscribe consent confirmation */}
      <Dialog open={Boolean(resubscribeConfirm)} onOpenChange={(open) => !open && setResubscribeConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resubscribe {resubscribeConfirm?.email}?</DialogTitle>
            <DialogDescription>
              This contact unsubscribed
              {resubscribeConfirm?.unsubscribedAt
                ? ` on ${new Date(resubscribeConfirm.unsubscribedAt).toLocaleDateString()}`
                : ""}
              . Manually resubscribing requires explicit recipient consent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResubscribeConfirm(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void submitAdd(true)} disabled={adding}>
              {adding ? "Resubscribing…" : "Resubscribe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global suppression block */}
      <Dialog open={Boolean(suppressedError)} onOpenChange={(open) => !open && setSuppressedError(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cannot add subscriber</DialogTitle>
            <DialogDescription>{suppressedError}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => setSuppressedError(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV — UC-S2 */}
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) setImportResult(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
            <DialogDescription>
              File must include an <code>email</code> column header, and optionally a{" "}
              <code>name</code> column. Up to 5,000 rows.
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-border p-3">
                <p className="text-lg font-semibold tabular-nums">{importResult.added}</p>
                <p className="text-xs text-muted-foreground">Added</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-lg font-semibold tabular-nums">{importResult.updated}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-lg font-semibold tabular-nums">{importResult.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
              }}
              className="text-sm"
            />
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setImportOpen(false)}>
              {importResult ? "Done" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
