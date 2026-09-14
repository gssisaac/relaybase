"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCrmPaths } from "@/crm/lib/paths";
import { crmApi, type Campaign, type CrmTemplate } from "@/lib/crm/api";

import { CampaignComposeForm } from "./CampaignComposeForm";

const AUTOSAVE_DELAY_MS = 3000;

function statusBadgeVariant(status: Campaign["status"]) {
  if (status === "sent") return "default" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "draft") return "outline" as const;
  return "secondary" as const;
}

function composeTitle(campaign: Campaign, subject: string) {
  if (campaign.status === "draft" || campaign.status === "failed") {
    return "Draft campaign";
  }
  return subject.trim() || "Campaign";
}

type DraftFields = { subject: string; bodyMarkdown: string; templateId: string };

export function CampaignComposeView({ campaignId }: { campaignId: string }) {
  const { campaigns } = useCrmPaths();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [templates, setTemplates] = useState<CrmTemplate[]>([]);
  const [subject, setSubject] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [sending, setSending] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [contactCountHasMore, setContactCountHasMore] = useState(false);

  const lastSaved = useRef<DraftFields | null>(null);
  const draftRef = useRef<DraftFields>({ subject: "", bodyMarkdown: "", templateId: "" });
  const persistInFlight = useRef<Promise<boolean> | null>(null);
  const editable = campaign?.status === "draft" || campaign?.status === "failed";

  draftRef.current = { subject, bodyMarkdown, templateId };

  useEffect(() => {
    void Promise.all([crmApi.getCampaign(campaignId), crmApi.listTemplates()]).then(
      ([c, t]) => {
        const nextTemplateId = c.templateId ?? t.templates[0]?.id ?? "";
        setCampaign(c);
        setSubject(c.subject);
        setBodyMarkdown(c.bodyMarkdown);
        setTemplateId(nextTemplateId);
        setTemplates(t.templates);
        lastSaved.current = {
          subject: c.subject,
          bodyMarkdown: c.bodyMarkdown,
          templateId: nextTemplateId,
        };
      },
      () => toast.error("Could not load campaign"),
    );
  }, [campaignId]);

  useEffect(() => {
    void crmApi.listContacts().then(
      (data) => {
        setContactCount(data.contacts.length);
        setContactCountHasMore(Boolean(data.nextCursor));
      },
      () => {
        setContactCount(null);
        setContactCountHasMore(false);
      },
    );
  }, []);

  function persistNow(): Promise<boolean> {
    if (!editable) return Promise.resolve(true);
    if (persistInFlight.current) return persistInFlight.current;

    const next = draftRef.current;
    const prev = lastSaved.current;
    if (
      prev &&
      prev.subject === next.subject &&
      prev.bodyMarkdown === next.bodyMarkdown &&
      prev.templateId === next.templateId
    ) {
      return Promise.resolve(true);
    }

    setSaveState("saving");
    const run = crmApi
      .updateCampaign(campaignId, next)
      .then(() => {
        lastSaved.current = next;
        setSaveState("idle");
        return true;
      })
      .catch(() => {
        setSaveState("error");
        return false;
      })
      .finally(() => {
        persistInFlight.current = null;
      });
    persistInFlight.current = run;
    return run;
  }

  useEffect(() => {
    if (!campaign || !editable) return;
    const timer = setTimeout(() => {
      void persistNow();
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [subject, bodyMarkdown, templateId, campaign, editable, campaignId]);

  const template = templates.find((t) => t.id === templateId);
  const renderedPreview = useMemo(() => {
    const content = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    if (!template) return content;
    return template.htmlSource
      .replaceAll("{{content}}", content)
      .replaceAll("{{unsubscribe_url}}", "#")
      .replaceAll("{{contact.name}}", "there")
      .replaceAll("{{contact.email}}", "you@example.com");
  }, [template, previewHtml]);

  async function handleSend() {
    setSending(true);
    try {
      const saved = await persistNow();
      if (!saved) {
        toast.error("Could not save campaign");
        return;
      }
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
      const saved = await persistNow();
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
      const saved = await persistNow();
      if (!saved) {
        toast.error("Could not save campaign");
        return;
      }
      const updated = await crmApi.scheduleCampaign(
        campaignId,
        new Date(scheduleAt).toISOString(),
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

  if (!campaign) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            nativeButton={false}
            render={<Link href={campaigns} />}
          >
            <ArrowLeft className="size-4" />
            Campaigns
          </Button>
          <h1 className="truncate text-sm font-semibold">
            {composeTitle(campaign, subject)}
          </h1>
          <Badge variant={statusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
        </div>
      </DesktopTitleBar>

      {campaign.status === "sent" ? (
        <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 px-4 pb-2 text-xs text-muted-foreground">
          <span>Sent: {campaign.stats.sent}</span>
          <span>
            Opened: {campaign.stats.opened} (
            {campaign.stats.sent
              ? Math.round((campaign.stats.opened / campaign.stats.sent) * 100)
              : 0}
            %)
          </span>
          <span>
            Clicked: {campaign.stats.clicked} (
            {campaign.stats.sent
              ? Math.round((campaign.stats.clicked / campaign.stats.sent) * 100)
              : 0}
            %)
          </span>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-6">
        <CampaignComposeForm
          campaignId={campaignId}
          templates={templates}
          templateId={templateId}
          setTemplateId={setTemplateId}
          contactCount={contactCount}
          contactCountHasMore={contactCountHasMore}
          subject={subject}
          setSubject={setSubject}
          bodyMarkdown={bodyMarkdown}
          onBodyChange={({ markdown, html }) => {
            setBodyMarkdown(markdown);
            setPreviewHtml(html);
          }}
          renderedPreview={renderedPreview}
          device={device}
          setDevice={setDevice}
          editable={Boolean(editable)}
          sending={sending}
          saveState={saveState}
          campaignStatus={campaign.status}
          onSend={() => void handleSend()}
          onTest={() => setTestEmailOpen(true)}
          onSchedule={() => setScheduleOpen(true)}
          onCancelSchedule={() => void handleCancelSchedule()}
        />
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
