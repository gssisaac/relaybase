"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { crmApi, type Campaign, type CrmTemplate } from "@/lib/crm/api";

const MarkdownEditor = dynamic(() => import("./MarkdownEditor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[300px] rounded-md border border-border/60 p-4 text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

const AUTOSAVE_DELAY_MS = 3000;

function statusBadgeVariant(status: Campaign["status"]) {
  if (status === "sent") return "default" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "draft") return "outline" as const;
  return "secondary" as const;
}

export function CampaignComposeView({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [templates, setTemplates] = useState<CrmTemplate[]>([]);
  const [subject, setSubject] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [sending, setSending] = useState(false);

  const lastSaved = useRef<{ subject: string; bodyMarkdown: string; templateId: string } | null>(
    null,
  );

  useEffect(() => {
    void Promise.all([crmApi.getCampaign(campaignId), crmApi.listTemplates()]).then(
      ([c, t]) => {
        setCampaign(c);
        setSubject(c.subject);
        setBodyMarkdown(c.bodyMarkdown);
        setTemplateId(c.templateId ?? t.templates[0]?.id ?? "");
        setTemplates(t.templates);
        lastSaved.current = {
          subject: c.subject,
          bodyMarkdown: c.bodyMarkdown,
          templateId: c.templateId ?? t.templates[0]?.id ?? "",
        };
      },
      () => toast.error("Could not load campaign"),
    );
  }, [campaignId]);

  const editable = campaign?.status === "draft" || campaign?.status === "failed";

  // 3s debounce autosave (P0-6) — skips the write when nothing actually changed.
  useEffect(() => {
    if (!campaign || !editable) return;
    const timer = setTimeout(() => {
      const next = { subject, bodyMarkdown, templateId };
      const prev = lastSaved.current;
      if (prev && prev.subject === next.subject && prev.bodyMarkdown === next.bodyMarkdown && prev.templateId === next.templateId) {
        return;
      }
      setSaveState("saving");
      crmApi
        .updateCampaign(campaignId, next)
        .then(() => {
          lastSaved.current = next;
          setSaveState("idle");
        })
        .catch(() => setSaveState("error"));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [subject, bodyMarkdown, templateId, campaign, editable, campaignId]);

  const template = templates.find((t) => t.id === templateId);
  const renderedPreview = useMemo(() => {
    if (!template) return previewHtml;
    return template.htmlSource
      .replaceAll("{{content}}", previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>")
      .replaceAll("{{unsubscribe_url}}", "#")
      .replaceAll("{{contact.name}}", "there")
      .replaceAll("{{contact.email}}", "you@example.com");
  }, [template, previewHtml]);

  async function handleSend() {
    setSending(true);
    try {
      const result = await crmApi.sendCampaign(campaignId);
      setCampaign(result.campaign);
      toast.success(`Sent to ${result.sent} contact${result.sent === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function handleTestSend() {
    if (!testEmail.includes("@")) return;
    try {
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
      const updated = await crmApi.scheduleCampaign(campaignId, new Date(scheduleAt).toISOString());
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

  if (!campaign) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!editable}
            placeholder="Subject"
            className="max-w-md text-base font-medium"
          />
          <Badge variant={statusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
          {editable ? (
            <span className="text-xs text-muted-foreground">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "error"
                  ? "Unsaved · retrying"
                  : "Saved"}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTestEmailOpen(true)}>
            Send test email
          </Button>
          {campaign.status === "scheduled" ? (
            <Button variant="outline" size="sm" onClick={() => void handleCancelSchedule()}>
              Cancel schedule
            </Button>
          ) : editable ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
                Schedule
              </Button>
              <Button size="sm" onClick={() => void handleSend()} disabled={sending}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {campaign.status === "sent" ? (
        <div className="flex gap-4 rounded-md border border-border/60 p-3 text-sm">
          <span>Sent: {campaign.stats.sent}</span>
          <span>
            Opened: {campaign.stats.opened} (
            {campaign.stats.sent ? Math.round((campaign.stats.opened / campaign.stats.sent) * 100) : 0}
            %)
          </span>
          <span>
            Clicked: {campaign.stats.clicked} (
            {campaign.stats.sent ? Math.round((campaign.stats.clicked / campaign.stats.sent) * 100) : 0}
            %)
          </span>
          <span className="text-muted-foreground">Last updated just now</span>
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center gap-2">
            <Label>Template</Label>
            <Select
              value={templateId}
              onValueChange={(next) => setTemplateId(next ?? "")}
              items={templates.map((t) => ({ value: t.id, label: t.name }))}
              disabled={!editable}
            >
              <SelectTrigger className="w-48">
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
          {editable ? (
            <MarkdownEditor
              key={campaignId}
              value={bodyMarkdown}
              onChange={({ markdown, html }) => {
                setBodyMarkdown(markdown);
                setPreviewHtml(html);
              }}
            />
          ) : (
            <div
              className="prose prose-sm max-w-none rounded-md border border-border/60 p-4 dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: previewHtml || "" }}
            />
          )}
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto">
          <div className="flex items-center gap-2">
            <Label>Preview</Label>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={device === "desktop" ? "secondary" : "ghost"}
                onClick={() => setDevice("desktop")}
              >
                Desktop
              </Button>
              <Button
                size="sm"
                variant={device === "mobile" ? "secondary" : "ghost"}
                onClick={() => setDevice("mobile")}
              >
                Mobile
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto rounded-md border border-border/60 bg-muted/20 p-4">
            <div
              className={device === "mobile" ? "mx-auto max-w-[375px]" : "mx-auto max-w-[640px]"}
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
            />
          </div>
        </div>
      </div>

      <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
        <DialogContent>
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
            <Button variant="ghost" onClick={() => setTestEmailOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleTestSend()} disabled={!testEmail.includes("@")}>
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
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
            <Button variant="ghost" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
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
