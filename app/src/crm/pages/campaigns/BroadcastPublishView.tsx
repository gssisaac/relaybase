"use client";

import { ExternalLink, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { AudienceGroupContact, AudienceGroupSummary } from "@/email/components/mailbox/types";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BroadcastStatusBadge } from "@/crm/components/BroadcastStatusBadge";
import { crmAudienceDetailHref, broadcastDetailHref } from "@/crm/lib/paths";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmAudienceApi } from "@/lib/crm/audience-api";
import { crmApi, CrmApiError } from "@/lib/crm/api";

const PREVIEW_CONTACT_LIMIT = 40;

type AudienceContactsDialog =
  | { mode: "confirm"; groupId: string }
  | { mode: "view"; groupId: string };

function AudienceContactsList({
  contacts,
  loading,
}: {
  contacts: AudienceGroupContact[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading contacts…
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
      <div className="divide-y divide-border">
        {contacts.slice(0, PREVIEW_CONTACT_LIMIT).map((c) => (
          <div key={c.id} className="px-3 py-2 text-sm">
            <p className="truncate font-medium">{c.name || c.email}</p>
            {c.name ? (
              <p className="truncate text-xs text-muted-foreground">{c.email}</p>
            ) : null}
          </div>
        ))}
      </div>
      {contacts.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          This group has no contacts yet.
        </p>
      ) : contacts.length > PREVIEW_CONTACT_LIMIT ? (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Showing first {PREVIEW_CONTACT_LIMIT} of {contacts.length.toLocaleString()} contacts.
        </p>
      ) : null}
    </div>
  );
}

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function BroadcastPublishView() {
  const router = useRouter();
  const {
    broadcastId,
    broadcast,
    setBroadcast,
    persistDraft,
    refresh,
    refreshAudience,
  } = useBroadcastDetail();

  const [sending, setSending] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [audienceGroups, setAudienceGroups] = useState<AudienceGroupSummary[]>([]);
  const [audienceGroupsLoading, setAudienceGroupsLoading] = useState(false);
  const [audienceContactsDialog, setAudienceContactsDialog] =
    useState<AudienceContactsDialog | null>(null);
  const [dialogContacts, setDialogContacts] = useState<AudienceGroupContact[]>([]);
  const [dialogContactsLoading, setDialogContactsLoading] = useState(false);
  const [savingAudience, setSavingAudience] = useState(false);

  useEffect(() => {
    if (broadcast?.status !== "sending") return;
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [broadcast?.status, refresh]);

  const sendDomain = broadcast?.domain ?? broadcast?.audienceGroupDomain ?? null;

  useEffect(() => {
    if (!broadcast) return;
    const canPickAudience =
      broadcast.status === "draft" || broadcast.status === "scheduled";
    if (!canPickAudience || !sendDomain) return;
    setAudienceGroupsLoading(true);
    crmAudienceApi
      .listGroups()
      .then(({ groups }) => setAudienceGroups(groups))
      .catch(() => toast.error("Could not load audience groups"))
      .finally(() => setAudienceGroupsLoading(false));
  }, [broadcast, sendDomain]);

  const groupsForDomain = useMemo(() => {
    const d = sendDomain?.toLowerCase();
    if (!d) return [];
    return audienceGroups.filter((g) => g.domain.toLowerCase() === d);
  }, [audienceGroups, sendDomain]);

  const audienceSelectItems = useMemo(
    () =>
      groupsForDomain.map((g) => ({
        value: g.id,
        label: `${g.name} · ${g.contactCount} contacts`,
      })),
    [groupsForDomain],
  );

  if (!broadcast) return null;

  const canChangeAudience =
    broadcast.status === "draft" || broadcast.status === "scheduled";
  const editable = canChangeAudience;
  const recipientCount = broadcast.audienceActiveCount;
  const hasLinkedAudience = Boolean(broadcast.audienceGroupId);
  const canOpenSend =
    editable &&
    !sending &&
    Boolean(broadcast.subject.trim()) &&
    hasLinkedAudience &&
    recipientCount > 0;

  async function loadDialogContacts(groupId: string) {
    setDialogContactsLoading(true);
    setDialogContacts([]);
    try {
      const detail = await crmAudienceApi.getGroup(groupId);
      setDialogContacts(detail.contacts);
    } catch {
      toast.error("Could not load audience contacts");
      setAudienceContactsDialog(null);
    } finally {
      setDialogContactsLoading(false);
    }
  }

  function openAudienceChangeConfirm(nextGroupId: string) {
    if (nextGroupId === broadcast!.audienceGroupId) return;
    setAudienceContactsDialog({ mode: "confirm", groupId: nextGroupId });
    void loadDialogContacts(nextGroupId);
  }

  function openAudienceView() {
    const groupId = broadcast!.audienceGroupId;
    if (!groupId) return;
    setAudienceContactsDialog({ mode: "view", groupId });
    void loadDialogContacts(groupId);
  }

  function closeAudienceContactsDialog() {
    if (savingAudience) return;
    setAudienceContactsDialog(null);
    setDialogContacts([]);
  }

  async function confirmAudienceChange() {
    if (!audienceContactsDialog || audienceContactsDialog.mode !== "confirm") return;
    setSavingAudience(true);
    try {
      const updated = await crmApi.updateBroadcast(broadcastId, {
        audienceGroupId: audienceContactsDialog.groupId,
      });
      setBroadcast(updated);
      await refreshAudience();
      closeAudienceContactsDialog();
      toast.success("Audience updated for this broadcast");
    } catch (err) {
      toast.error(err instanceof CrmApiError ? err.message : "Could not update audience");
    } finally {
      setSavingAudience(false);
    }
  }

  const dialogGroupId = audienceContactsDialog?.groupId;
  const dialogGroup =
    dialogGroupId != null
      ? (groupsForDomain.find((g) => g.id === dialogGroupId) ??
        (broadcast.audienceGroupId === dialogGroupId
          ? {
              id: dialogGroupId,
              name: broadcast.audienceGroupName ?? "Audience group",
              domain: broadcast.audienceGroupDomain ?? sendDomain ?? "",
              contactCount: broadcast.audienceContactCount ?? dialogContacts.length,
              createdAt: "",
            }
          : undefined))
      : undefined;

  async function ensureSaved(): Promise<boolean> {
    const saved = await persistDraft();
    if (!saved) toast.error("Could not save broadcast");
    return saved;
  }

  async function handleConfirmSend() {
    setSending(true);
    try {
      const saved = await ensureSaved();
      if (!saved) return;
      const result = await crmApi.sendBroadcast(broadcastId);
      setBroadcast(result.broadcast);
      setConfirmSendOpen(false);
      if (result.async || result.broadcast.status === "sending") {
        toast.success("Broadcast is sending — stats update as delivery progresses");
        router.push(broadcastDetailHref(broadcastId, "stats"));
      } else {
        toast.success("Broadcast sent — view stats for delivery details");
        router.push(broadcastDetailHref(broadcastId, "stats"));
      }
    } catch (err) {
      setConfirmSendOpen(false);
      setBlockedError(err instanceof CrmApiError ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function handleTestSend() {
    if (!testEmail.includes("@")) return;
    try {
      const saved = await ensureSaved();
      if (!saved) return;
      await crmApi.testSendBroadcast(broadcastId, testEmail);
      toast.success(`Test email sent to ${testEmail}`);
      setTestEmailOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed: check Worker connection");
    }
  }

  async function handleSchedule() {
    if (!scheduleAt || new Date(scheduleAt).getTime() <= Date.now()) return;
    try {
      const saved = await ensureSaved();
      if (!saved) return;
      const updated = await crmApi.scheduleBroadcast(broadcastId, new Date(scheduleAt).toISOString());
      setBroadcast(updated);
      setScheduleOpen(false);
      toast.success(`Broadcast scheduled for ${formatWhen(updated.scheduledAt)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not schedule");
    }
  }

  async function handleCancelSchedule() {
    try {
      const updated = await crmApi.cancelSchedule(broadcastId);
      setBroadcast(updated);
      toast.success("Schedule cancelled. Broadcast reverted to draft.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cannot cancel: Broadcast dispatch has already begun.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Publish</h2>
        <p className="text-xs text-muted-foreground">
          Send to active broadcast audience members (late binding at send time).
        </p>
      </div>

      {broadcast.status === "sending" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs text-sky-800 dark:text-sky-300">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
            <span>
              This broadcast is currently sending to {recipientCount.toLocaleString()} recipient
              {recipientCount === 1 ? "" : "s"}. Delivery stats update automatically.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={broadcastDetailHref(broadcastId, "stats")} />}
          >
            Live stats
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Audience</CardTitle>
          <CardDescription>
            {canChangeAudience
              ? "Choose who receives this broadcast. Only groups on the same sending domain are listed."
              : "Linked audience at send time (unsubscribed and bounced excluded)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canChangeAudience ? (
            <div className="space-y-1.5">
              <Label htmlFor="publish-audience">Audience group</Label>
              {!sendDomain ? (
                <p className="text-sm text-muted-foreground">
                  Set a sending domain on Settings before choosing an audience.
                </p>
              ) : audienceGroupsLoading ? (
                <p className="text-sm text-muted-foreground">Loading audience groups…</p>
              ) : groupsForDomain.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No audience groups on {sendDomain} — create one in Audience first.
                </p>
              ) : (
                <div className="flex max-w-lg flex-wrap items-center gap-2">
                  <Select
                    items={audienceSelectItems}
                    value={broadcast.audienceGroupId || null}
                    onValueChange={(value) => {
                      if (value) openAudienceChangeConfirm(value);
                    }}
                  >
                    <SelectTrigger id="publish-audience" className="min-w-0 flex-1">
                      <SelectValue placeholder="Select audience group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupsForDomain.map((g) => {
                        const label = `${g.name} · ${g.contactCount} contacts`;
                        return (
                          <SelectItem key={g.id} value={g.id} label={label}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={!hasLinkedAudience}
                    onClick={() => openAudienceView()}
                  >
                    <Users className="size-4" />
                    View contacts
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {broadcast.audienceGroupName ?? "Audience group"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {broadcast.audienceGroupDomain ?? sendDomain ?? "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {broadcast.audienceGroupId ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openAudienceView()}
                    >
                      <Users className="size-4" />
                      View contacts
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={
                        <Link href={crmAudienceDetailHref(broadcast.audienceGroupId)} />
                      }
                    >
                      <ExternalLink className="size-3.5" />
                      Open in Audience
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-sm font-medium tabular-nums">
              {recipientCount.toLocaleString()} active recipient{recipientCount === 1 ? "" : "s"}
            </p>
            <BroadcastStatusBadge
              status={broadcast.status}
              listStatus={broadcast.listStatus}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Send</CardTitle>
          <CardDescription>
            {broadcast.status === "scheduled" && broadcast.scheduledAt
              ? `Scheduled for ${formatWhen(broadcast.scheduledAt)}`
              : broadcast.status === "sending"
                ? `Sending in progress since ${formatWhen(broadcast.sentAt)}`
                : broadcast.status === "sent"
                  ? `Sent ${formatWhen(broadcast.sentAt)}`
                  : "Save content first, then send or schedule from here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {editable ? (
            <Button size="sm" variant="outline" onClick={() => setTestEmailOpen(true)}>
              Send test
            </Button>
          ) : null}
          {broadcast.status === "scheduled" ? (
            <Button size="sm" variant="outline" onClick={() => void handleCancelSchedule()}>
              Cancel schedule
            </Button>
          ) : broadcast.status === "sending" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-sky-600 dark:text-sky-400">
                Dispatch in progress…
              </span>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={broadcastDetailHref(broadcastId, "stats")} />}
              >
                View delivery progress
              </Button>
            </div>
          ) : editable ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
                Schedule
              </Button>
              <Button size="sm" onClick={() => setConfirmSendOpen(true)} disabled={!canOpenSend}>
                {sending ? "Sending…" : "Send Now"}
              </Button>
            </>
          ) : null}
          {editable && !broadcast.subject.trim() ? (
            <p className="w-full text-xs text-muted-foreground">
              Add a subject on the Content tab before sending.
            </p>
          ) : null}
          {editable && broadcast.subject.trim() && !hasLinkedAudience ? (
            <p className="w-full text-xs text-muted-foreground">
              Select an audience group above before sending.
            </p>
          ) : null}
          {editable && hasLinkedAudience && recipientCount === 0 ? (
            <p className="w-full text-xs text-muted-foreground">
              Linked audience has no active contacts — add subscribers in Audience or pick another
              group.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {broadcast.status === "sent" || broadcast.stats.sent > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">Send summary</CardTitle>
              <CardDescription>
                {broadcast.stats.delivered} delivered · {broadcast.stats.opened} opened ·{" "}
                {broadcast.stats.clicked} clicked
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={broadcastDetailHref(broadcastId, "stats")} />}
            >
              Full stats
            </Button>
          </CardHeader>
        </Card>
      ) : null}

      <Dialog
        open={audienceContactsDialog !== null}
        onOpenChange={(open) => {
          if (!open) closeAudienceContactsDialog();
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,640px)] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {audienceContactsDialog?.mode === "confirm"
                ? "Switch audience for this broadcast?"
                : dialogGroup
                  ? `Contacts in “${dialogGroup.name}”`
                  : "Audience contacts"}
            </DialogTitle>
            <DialogDescription>
              {dialogGroup
                ? audienceContactsDialog?.mode === "confirm"
                  ? `Send to “${dialogGroup.name}” on ${dialogGroup.domain} — ${dialogGroup.contactCount.toLocaleString()} contacts in the group. Review the list before confirming.`
                  : `${recipientCount.toLocaleString()} active recipient${recipientCount === 1 ? "" : "s"} at send time (unsubscribed excluded).`
                : "Review contacts in this audience group."}
            </DialogDescription>
          </DialogHeader>
          <AudienceContactsList contacts={dialogContacts} loading={dialogContactsLoading} />
          <DialogFooter>
            {audienceContactsDialog?.mode === "confirm" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingAudience}
                  onClick={() => closeAudienceContactsDialog()}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={savingAudience || dialogContactsLoading}
                  onClick={() => void confirmAudienceChange()}
                >
                  {savingAudience ? "Saving…" : "Use this audience"}
                </Button>
              </>
            ) : (
              <>
                {dialogGroupId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={crmAudienceDetailHref(dialogGroupId)} />}
                  >
                    Open in Audience
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => closeAudienceContactsDialog()}>
                  Close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send confirmation — UC-B4 */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send &apos;{broadcast.subject || "Untitled draft"}&apos; immediately?</DialogTitle>
            <DialogDescription>
              This will send to {recipientCount.toLocaleString()} active recipient
              {recipientCount === 1 ? "" : "s"} in &apos;
              {broadcast.audienceGroupName ?? "the selected audience"}&apos;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmSendOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleConfirmSend()} disabled={sending}>
              {sending ? "Sending…" : "Confirm Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocked send (0 subscribers, etc.) */}
      <Dialog open={Boolean(blockedError)} onOpenChange={(open) => !open && setBlockedError(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cannot send broadcast</DialogTitle>
            <DialogDescription>{blockedError}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => setBlockedError(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send test email</DialogTitle>
          </DialogHeader>
          <Input
            type="email"
            placeholder="you@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTestEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleTestSend()}
              disabled={!testEmail.includes("@")}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule send</DialogTitle>
          </DialogHeader>
          <Input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
          />
          {scheduleAt && new Date(scheduleAt).getTime() <= Date.now() ? (
            <p className="text-xs text-destructive">Choose a time after now</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSchedule()}
              disabled={!scheduleAt || new Date(scheduleAt).getTime() <= Date.now()}
            >
              Schedule Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
