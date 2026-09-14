"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { broadcastDetailHref } from "@/crm/lib/paths";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmApi, CrmApiError } from "@/lib/crm/api";

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
  const { broadcastId, broadcast, setBroadcast, persistDraft } = useBroadcastDetail();

  const [sending, setSending] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  if (!broadcast) return null;

  const editable = broadcast.status === "draft";
  const recipientCount = broadcast.audienceActiveCount;
  const canOpenSend = editable && !sending && Boolean(broadcast.subject.trim());

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
      toast.success("Broadcast send started");
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

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const duplicate = await crmApi.duplicateBroadcast(broadcastId);
      router.push(broadcastDetailHref(duplicate.id, "content"));
    } catch {
      toast.error("Could not duplicate broadcast");
      setDuplicating(false);
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

      {broadcast.status === "sent" ? (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          This broadcast was sent on {formatWhen(broadcast.sentAt)} and is locked.
          <Button
            size="sm"
            variant="outline"
            className="ml-3"
            onClick={() => void handleDuplicate()}
            disabled={duplicating}
          >
            {duplicating ? "Duplicating…" : "Duplicate as New Draft"}
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recipients</CardTitle>
          <CardDescription>
            Resolved from &apos;{broadcast.name}&apos; audience at send time (unsubscribed excluded).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium tabular-nums">
            {recipientCount.toLocaleString()} active recipient{recipientCount === 1 ? "" : "s"}
          </p>
          <Badge variant="outline" className="capitalize">
            {broadcast.status}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Send</CardTitle>
          <CardDescription>
            {broadcast.status === "scheduled" && broadcast.scheduledAt
              ? `Scheduled for ${formatWhen(broadcast.scheduledAt)}`
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
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Sent</CardDescription>
            <CardTitle className="tabular-nums">{broadcast.stats.sent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Opened</CardDescription>
            <CardTitle className="tabular-nums">{broadcast.stats.opened}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Clicked</CardDescription>
            <CardTitle className="tabular-nums">{broadcast.stats.clicked}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Failed</CardDescription>
            <CardTitle className="tabular-nums">{broadcast.stats.failed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Send confirmation — UC-B4 */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send &apos;{broadcast.subject || "Untitled draft"}&apos; immediately?</DialogTitle>
            <DialogDescription>
              This will send to {recipientCount.toLocaleString()} recipient
              {recipientCount === 1 ? "" : "s"}.
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
