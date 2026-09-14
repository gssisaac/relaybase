"use client";

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmApi } from "@/lib/crm/api";

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rate(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function CampaignPublishView() {
  const {
    campaign,
    campaignId,
    audienceRecipientCount,
    setCampaign,
    persistDraft,
    resolveRecipients,
  } = useCampaignDetail();

  const [sending, setSending] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  if (!campaign) return null;

  const editable = campaign.status === "draft" || campaign.status === "failed";
  const canSend = editable && !sending && Boolean(campaign.subject.trim());
  const recipients =
    audienceRecipientCount == null
      ? "All audience members"
      : `All audience members · ${audienceRecipientCount.toLocaleString()}`;

  async function handleSend() {
    setSending(true);
    try {
      const saved = await persistDraft();
      if (!saved) {
        toast.error("Could not save campaign");
        return;
      }
      const recipientsList = await resolveRecipients();
      if (recipientsList.length === 0) {
        toast.error("No audience members — add groups in Audience first");
        return;
      }
      const result = await crmApi.sendCampaign(campaignId, recipientsList);
      setCampaign(result.campaign);
      toast.success(`Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function handleTestSend() {
    if (!testEmail.includes("@")) return;
    try {
      const saved = await persistDraft();
      if (!saved) {
        toast.error("Could not save campaign");
        return;
      }
      await crmApi.testSendCampaign(campaignId, testEmail);
      toast.success("Test email sent");
      setTestEmailOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed: check Worker connection");
    }
  }

  async function handleSchedule() {
    if (!scheduleAt || new Date(scheduleAt).getTime() <= Date.now()) return;
    try {
      const saved = await persistDraft();
      if (!saved) {
        toast.error("Could not save campaign");
        return;
      }
      const recipientsList = await resolveRecipients();
      if (recipientsList.length === 0) {
        toast.error("No audience members — add groups in Audience first");
        return;
      }
      const updated = await crmApi.scheduleCampaign(
        campaignId,
        new Date(scheduleAt).toISOString(),
        recipientsList,
      );
      setCampaign(updated);
      setScheduleOpen(false);
      toast.success(`Scheduled · ${new Date(updated.scheduledAt!).toLocaleString()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not schedule");
    }
  }

  async function handleCancelSchedule() {
    try {
      const updated = await crmApi.cancelSchedule(campaignId);
      setCampaign(updated);
      toast.success("Schedule canceled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Publish</h2>
        <p className="text-xs text-muted-foreground">
          Send this campaign to your Worker audience and track delivery.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recipients</CardTitle>
          <CardDescription>v0.2 sends to every member across all audience groups.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">{recipients}</p>
          <Badge variant="outline" className="capitalize">
            {campaign.status}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Send</CardTitle>
          <CardDescription>
            {campaign.status === "scheduled" && campaign.scheduledAt
              ? `Scheduled for ${formatWhen(campaign.scheduledAt)}`
              : campaign.status === "sent"
                ? `Sent ${formatWhen(campaign.sentAt)}`
                : "Save content first, then send or schedule from here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setTestEmailOpen(true)}>
            Send test
          </Button>
          {campaign.status === "scheduled" ? (
            <Button size="sm" variant="outline" onClick={() => void handleCancelSchedule()}>
              Cancel schedule
            </Button>
          ) : editable ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
                Schedule
              </Button>
              <Button size="sm" onClick={() => void handleSend()} disabled={!canSend}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </>
          ) : null}
          {editable && !campaign.subject.trim() ? (
            <p className="w-full text-xs text-muted-foreground">
              Add a subject on the Content tab before sending.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Sent</CardDescription>
            <CardTitle className="tabular-nums">{campaign.stats.sent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Opened</CardDescription>
            <CardTitle className="tabular-nums">
              {campaign.stats.opened}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({rate(campaign.stats.opened, campaign.stats.sent)})
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Clicked</CardDescription>
            <CardTitle className="tabular-nums">
              {campaign.stats.clicked}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({rate(campaign.stats.clicked, campaign.stats.sent)})
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

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
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
