"use client";

import { Calendar, ChevronDown, Loader2, Mail, Send, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { AudienceGroupSummary } from "@/email/components/mailbox/types";
import { useEmailPaths } from "@/email/lib/paths";
import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import { Button } from "@/components/ui/button";
import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scaleApi, ScaleApiError, type TriggerPurpose } from "@/lib/scale/api";
import { scaleAudienceApi } from "@/lib/scale/audience-api";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { AudienceGroupCmdDropdown } from "@/scale/components/AudienceGroupCmdDropdown";
import { campaignDetailHref, triggerDetailHref } from "@/scale/lib/paths";
import {
  createCampaignFromHubTemplate,
  createTriggerFromHubTemplate,
  type HubTemplateSnapshot,
} from "@/scale/lib/templates/hub-template-launch";
import { syncScaleSendCredentials } from "@/scale/lib/sync-scale-send-credentials";
import { useTemplateDetail } from "@/scale/pages/templates/TemplateDetailContext";

type CampaignDialogMode = "draft" | "schedule";

const TRIGGER_PURPOSE_OPTIONS: { value: TriggerPurpose; label: string }[] = [
  { value: "transactional", label: "Transactional" },
  { value: "conversational", label: "Conversational" },
  { value: "marketing", label: "Marketing" },
];

function snapshotFromDraft(draft: {
  subject: string;
  previewText: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
}): HubTemplateSnapshot {
  return {
    subject: draft.subject,
    previewText: draft.previewText,
    bodyMarkdown: draft.bodyMarkdown,
    layoutId: draft.templateId,
    templateVariables: draft.templateVariables,
  };
}

function resolveGroupDomain(
  groups: AudienceGroupSummary[],
  groupId: string,
): string | null {
  const group = groups.find((g) => g.id === groupId);
  return group?.domain.trim().toLowerCase() || null;
}

export function TemplateUseActions() {
  const router = useRouter();
  const { apiBase } = useEmailPaths();
  const { messageTemplateId, template, persistDraft, getDraft } = useTemplateDetail();

  const [testOpen, setTestOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignMode, setCampaignMode] = useState<CampaignDialogMode>("draft");
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [campaignAudienceId, setCampaignAudienceId] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");

  const [triggerName, setTriggerName] = useState("");
  const [triggerSenderEmail, setTriggerSenderEmail] = useState<string | null>(null);
  const [triggerDomain, setTriggerDomain] = useState<string | null>(null);
  const [triggerPurpose, setTriggerPurpose] = useState<TriggerPurpose>("transactional");

  const [testAudienceId, setTestAudienceId] = useState("");
  const [testFromEmail, setTestFromEmail] = useState<string | null>(null);
  const [testToEmail, setTestToEmail] = useState("");

  const [audienceGroups, setAudienceGroups] = useState<AudienceGroupSummary[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const defaultTitle =
    template?.name.trim() || template?.subject.trim() || "Untitled template";

  const testAudienceDomain = useMemo(
    () => resolveGroupDomain(audienceGroups, testAudienceId),
    [audienceGroups, testAudienceId],
  );

  useEffect(() => {
    setAudienceLoading(true);
    scaleAudienceApi
      .listGroups()
      .then(({ groups }) => setAudienceGroups(groups))
      .catch(() => {})
      .finally(() => setAudienceLoading(false));
  }, []);

  function resetCampaignForm(mode: CampaignDialogMode) {
    setCampaignMode(mode);
    setCampaignName(defaultTitle);
    setCampaignAudienceId("");
    setScheduleAt("");
    setFormError(null);
  }

  function resetTriggerForm() {
    setTriggerName(defaultTitle);
    setTriggerSenderEmail(null);
    setTriggerDomain(null);
    setTriggerPurpose("transactional");
    setFormError(null);
  }

  function resetTestForm() {
    setTestAudienceId("");
    setTestFromEmail(null);
    setTestToEmail("");
    setFormError(null);
  }

  async function ensureTemplateSaved(): Promise<HubTemplateSnapshot | null> {
    const saved = await persistDraft();
    if (!saved) {
      toast.error("Could not save template");
      return null;
    }
    return snapshotFromDraft(getDraft());
  }

  async function prepareCredentials(domain: string): Promise<boolean> {
    try {
      await syncScaleSendCredentials({ apiBase, sendingDomain: domain });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not configure send credentials");
      return false;
    }
  }

  async function handleCreateCampaign() {
    const name = campaignName.trim();
    const audienceGroupId = campaignAudienceId.trim();
    const domain = resolveGroupDomain(audienceGroups, audienceGroupId);
    if (!name) {
      setFormError("Campaign name is required");
      return;
    }
    if (!audienceGroupId || !domain) {
      setFormError("Select a subscriber group");
      return;
    }
    if (campaignMode === "schedule") {
      if (!scheduleAt || new Date(scheduleAt).getTime() <= Date.now()) {
        setFormError("Choose a schedule time in the future");
        return;
      }
    }

    setBusy(true);
    setFormError(null);
    try {
      const snapshot = await ensureTemplateSaved();
      if (!snapshot) return;

      const campaign = await createCampaignFromHubTemplate({
        name,
        domain,
        audienceGroupId,
        hubTemplateId: messageTemplateId,
        snapshot,
      });

      if (campaignMode === "schedule") {
        if (!(await prepareCredentials(domain))) return;
        const scheduled = await scaleApi.scheduleCampaign(
          campaign.id,
          new Date(scheduleAt).toISOString(),
        );
        toast.success(
          `Campaign scheduled for ${new Date(scheduled.scheduledAt ?? scheduleAt).toLocaleString()}`,
        );
        setCampaignOpen(false);
        router.push(campaignDetailHref(campaign.id, "publish", scheduled.status));
        return;
      }

      toast.success(`Campaign “${campaign.name}” created`);
      setCampaignOpen(false);
      router.push(campaignDetailHref(campaign.id, "content"));
    } catch (err) {
      setFormError(err instanceof ScaleApiError ? err.message : "Could not create campaign");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTrigger() {
    const name = triggerName.trim();
    const domain = triggerDomain?.trim().toLowerCase();
    if (!name) {
      setFormError("Trigger name is required");
      return;
    }
    if (!domain) {
      setFormError("Select a sending account");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const snapshot = await ensureTemplateSaved();
      if (!snapshot) return;

      const trigger = await createTriggerFromHubTemplate({
        name,
        domain,
        purpose: triggerPurpose,
        hubTemplateId: messageTemplateId,
        snapshot,
      });
      toast.success(`Trigger “${trigger.name}” created`);
      setTriggerOpen(false);
      router.push(triggerDetailHref(trigger.id, "preview", trigger.status));
    } catch (err) {
      setFormError(err instanceof ScaleApiError ? err.message : "Could not create trigger");
    } finally {
      setBusy(false);
    }
  }

  async function handleTestSend() {
    const audienceGroupId = testAudienceId.trim();
    const domain = resolveGroupDomain(audienceGroups, audienceGroupId);
    const from = testFromEmail?.trim() ?? "";
    const to = testToEmail.trim();
    if (!audienceGroupId || !domain) {
      setFormError("Select a subscriber group");
      return;
    }
    if (!from.includes("@")) {
      setFormError("Select a sender account");
      return;
    }
    const fromDomain = from.slice(from.indexOf("@") + 1).toLowerCase();
    if (fromDomain !== domain) {
      setFormError(`Sender must be on ${domain} (same as the subscriber group)`);
      return;
    }
    if (!to.includes("@")) {
      setFormError("Enter a valid test recipient");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const snapshot = await ensureTemplateSaved();
      if (!snapshot) return;
      if (!(await prepareCredentials(domain))) return;

      const campaign = await createCampaignFromHubTemplate({
        name: `Test: ${defaultTitle}`.slice(0, 120),
        domain,
        audienceGroupId,
        hubTemplateId: messageTemplateId,
        snapshot,
        fromEmail: from,
      });

      await scaleApi.testSendCampaign(campaign.id, to);
      toast.success(`Test email sent to ${to}`);
      setTestOpen(false);
    } catch (err) {
      setFormError(err instanceof ScaleApiError ? err.message : "Test send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            resetTestForm();
            setTestOpen(true);
          }}
        >
          {busy && testOpen ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Test send
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm" disabled={busy}>
                Use template
                <ChevronDown className="size-4 opacity-70" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                resetCampaignForm("draft");
                setCampaignOpen(true);
              }}
            >
              <Mail className="size-4" />
              Create campaign
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                resetCampaignForm("schedule");
                setCampaignOpen(true);
              }}
            >
              <Calendar className="size-4" />
              Schedule send
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                resetTriggerForm();
                setTriggerOpen(true);
              }}
            >
              <Zap className="size-4" />
              Create trigger
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send test email</DialogTitle>
            <DialogDescription>
              Creates a draft campaign with this template, sends one message, and leaves the draft in
              Campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-test-audience">Subscriber group</Label>
              <AudienceGroupCmdDropdown
                triggerId="template-test-audience"
                groups={audienceGroups}
                loading={audienceLoading}
                value={testAudienceId || null}
                onValueChange={(id) => setTestAudienceId(id ?? "")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-test-from">From</Label>
              <AccountCmdDropdown
                triggerId="template-test-from"
                value={testFromEmail}
                domainFilter={testAudienceDomain}
                onValueChange={(email) => setTestFromEmail(email ?? null)}
              />
              {testAudienceDomain ? (
                <p className="text-xs text-muted-foreground">
                  Senders on {testAudienceDomain} (matches the subscriber group domain).
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-test-to">Send to</Label>
              <Input
                id="template-test-to"
                type="email"
                placeholder="you@example.com"
                value={testToEmail}
                onChange={(e) => setTestToEmail(e.target.value)}
              />
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setTestOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void handleTestSend()}>
              {busy ? "Sending…" : "Send test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={campaignOpen}
        onOpenChange={(open) => {
          setCampaignOpen(open);
          if (open) resetCampaignForm(campaignMode);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {campaignMode === "schedule" ? "Schedule campaign" : "Create campaign"}
            </DialogTitle>
            <DialogDescription>
              {campaignMode === "schedule"
                ? "New campaign from this template, scheduled to send to the linked audience."
                : "New draft campaign with this template’s subject and body."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-campaign-name">Name</Label>
              <Input
                id="template-campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder={examplePlaceholder("March newsletter")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-campaign-audience">Subscriber group</Label>
              <AudienceGroupCmdDropdown
                triggerId="template-campaign-audience"
                groups={audienceGroups}
                loading={audienceLoading}
                value={campaignAudienceId || null}
                onValueChange={(id) => setCampaignAudienceId(id ?? "")}
              />
            </div>
            {campaignMode === "schedule" ? (
              <div className="space-y-1.5">
                <Label htmlFor="template-schedule-at">Send at</Label>
                <Input
                  id="template-schedule-at"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>
            ) : null}
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setCampaignOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void handleCreateCampaign()}>
              {busy
                ? "Working…"
                : campaignMode === "schedule"
                  ? "Schedule campaign"
                  : "Create campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create trigger</DialogTitle>
            <DialogDescription>
              New draft trigger with this template’s content. Configure the trigger source after
              creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-trigger-name">Name</Label>
              <Input
                id="template-trigger-name"
                value={triggerName}
                onChange={(e) => setTriggerName(e.target.value)}
                placeholder={examplePlaceholder("Verify Email")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <CmdDropdown
                triggerClassName="min-w-0"
                value={triggerPurpose}
                options={TRIGGER_PURPOSE_OPTIONS}
                enableSearch={false}
                onValueChange={(v) => {
                  if (v === "transactional" || v === "conversational" || v === "marketing") {
                    setTriggerPurpose(v);
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-trigger-sender">Sending account</Label>
              <AccountCmdDropdown
                triggerId="template-trigger-sender"
                value={triggerSenderEmail}
                onValueChange={(email, ctx) => {
                  setTriggerSenderEmail(email ?? null);
                  setTriggerDomain(ctx?.domain ?? null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Sending domain is taken from the account you pick.
              </p>
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setTriggerOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void handleCreateTrigger()}>
              {busy ? "Creating…" : "Create trigger"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
