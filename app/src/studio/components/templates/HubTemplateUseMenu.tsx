"use client";

import { Calendar, ChevronDown, Mail, Send, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { SubscriberGroupSummary } from "@/email/components/mailbox/types";
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
import { studioApi, StudioApiError, type TriggerPurpose } from "@/studio/api";
import { studioSubscriberApi } from "@/studio/api";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { SubscriberGroupCmdDropdown } from "@/studio/components/SubscriberGroupCmdDropdown";
import { newsletterDetailHref, triggerDetailHref } from "@/studio/lib/paths";
import {
  createNewsletterFromHubTemplate,
  createTriggerFromHubTemplate,
  type HubTemplateSnapshot,
} from "@/studio/lib/templates/hub-template-launch";
import {
  BROADCAST_MERGE_TAGS,
  type BroadcastMergeTag,
} from "@/studio/lib/newsletters/newsletter-merge-tags";
import { syncStudioSendCredentials } from "@/studio/lib/send/sync-studio-send-credentials";

function mergeTagKey(token: string): string {
  return token.replace(/^\{\{|\}\}$/g, "").trim();
}

function mergeTagsUsedInContent(subject: string, bodyMarkdown: string): BroadcastMergeTag[] {
  const haystack = `${subject}\n${bodyMarkdown}`;
  return BROADCAST_MERGE_TAGS.filter((tag) => haystack.includes(tag.token));
}

type NewsletterDialogMode = "draft" | "schedule";

const TRIGGER_PURPOSE_OPTIONS: { value: TriggerPurpose; label: string }[] = [
  { value: "transactional", label: "Transactional" },
  { value: "conversational", label: "Conversational" },
  { value: "marketing", label: "Marketing" },
];

function resolveGroupDomain(
  groups: SubscriberGroupSummary[],
  groupId: string,
): string | null {
  const group = groups.find((g) => g.id === groupId);
  return group?.domain.trim().toLowerCase() || null;
}

export function HubTemplateUseMenu({
  defaultTitle,
  hubTemplateId,
  mergeTagSource,
  resolveSnapshot,
  runTestSend,
  triggerLabel = "Use template",
}: {
  defaultTitle: string;
  hubTemplateId: string;
  mergeTagSource: { subject: string; bodyMarkdown: string };
  resolveSnapshot: () => Promise<HubTemplateSnapshot | null>;
  runTestSend: (input: {
    to: string;
    fromEmail: string;
    mergeTags: Record<string, string>;
  }) => Promise<void>;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const { apiBase } = useEmailPaths();

  const [testOpen, setTestOpen] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [newsletterMode, setNewsletterMode] = useState<NewsletterDialogMode>("draft");
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newsletterSubscriberGroupId, setNewsletterSubscriberGroupId] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");

  const [triggerName, setTriggerName] = useState("");
  const [triggerSenderEmail, setTriggerSenderEmail] = useState<string | null>(null);
  const [triggerDomain, setTriggerDomain] = useState<string | null>(null);
  const [triggerPurpose, setTriggerPurpose] = useState<TriggerPurpose>("transactional");

  const [testFromEmail, setTestFromEmail] = useState<string | null>(null);
  const [testToEmail, setTestToEmail] = useState("");
  const [testMergeTagFields, setTestMergeTagFields] = useState<BroadcastMergeTag[]>([]);
  const [testMergeValues, setTestMergeValues] = useState<Record<string, string>>({});

  const [subscriberGroups, setSubscriberGroups] = useState<SubscriberGroupSummary[]>([]);
  const [subscriberGroupsLoading, setSubscriberGroupsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setSubscriberGroupsLoading(true);
    studioSubscriberApi
      .listGroups()
      .then(({ groups }) => setSubscriberGroups(groups))
      .catch(() => {})
      .finally(() => setSubscriberGroupsLoading(false));
  }, []);

  function resetNewsletterForm(mode: NewsletterDialogMode) {
    setNewsletterMode(mode);
    setNewsletterSubscriberGroupId("");
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
    setTestFromEmail(null);
    setTestToEmail("");
    setFormError(null);
    const fields = mergeTagsUsedInContent(
      mergeTagSource.subject,
      mergeTagSource.bodyMarkdown,
    );
    setTestMergeTagFields(fields);
    const values: Record<string, string> = {};
    for (const field of fields) {
      values[mergeTagKey(field.token)] = field.example;
    }
    setTestMergeValues(values);
  }

  async function prepareCredentials(domain: string): Promise<boolean> {
    try {
      await syncStudioSendCredentials({ apiBase, sendingDomain: domain });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not configure send credentials");
      return false;
    }
  }

  async function handleCreateNewsletter() {
    const subscriberGroupId = newsletterSubscriberGroupId.trim();
    const domain = resolveGroupDomain(subscriberGroups, subscriberGroupId);
    if (!subscriberGroupId || !domain) {
      setFormError("Select a subscriber group");
      return;
    }
    if (newsletterMode === "schedule") {
      if (!scheduleAt || new Date(scheduleAt).getTime() <= Date.now()) {
        setFormError("Choose a schedule time in the future");
        return;
      }
    }

    setBusy(true);
    setFormError(null);
    try {
      const snapshot = await resolveSnapshot();
      if (!snapshot) return;

      const newsletter = await createNewsletterFromHubTemplate({
        domain,
        subscriberGroupId,
        hubTemplateId,
        snapshot,
      });

      if (newsletterMode === "schedule") {
        if (!(await prepareCredentials(domain))) return;
        const scheduled = await studioApi.scheduleNewsletter(
          newsletter.id,
          new Date(scheduleAt).toISOString(),
        );
        toast.success(
          `Newsletter scheduled for ${new Date(scheduled.scheduledAt ?? scheduleAt).toLocaleString()}`,
        );
        setNewsletterOpen(false);
        router.push(newsletterDetailHref(newsletter.id, "publish", scheduled.status));
        return;
      }

      toast.success(`Newsletter “${newsletter.subject.trim() || "(No subject)"}” created`);
      setNewsletterOpen(false);
      router.push(newsletterDetailHref(newsletter.id, "content"));
    } catch (err) {
      setFormError(err instanceof StudioApiError ? err.message : "Could not create newsletter");
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
      const snapshot = await resolveSnapshot();
      if (!snapshot) return;

      const trigger = await createTriggerFromHubTemplate({
        name,
        domain,
        purpose: triggerPurpose,
        hubTemplateId,
        snapshot,
      });
      toast.success(`Trigger “${trigger.name}” created`);
      setTriggerOpen(false);
      router.push(triggerDetailHref(trigger.id, "config", trigger.status));
    } catch (err) {
      setFormError(err instanceof StudioApiError ? err.message : "Could not create trigger");
    } finally {
      setBusy(false);
    }
  }

  async function handleTestSend() {
    const from = testFromEmail?.trim() ?? "";
    const to = testToEmail.trim();
    if (!from.includes("@")) {
      setFormError("Select a sender account");
      return;
    }
    if (!to.includes("@")) {
      setFormError("Enter a valid recipient email");
      return;
    }
    const domain = from.slice(from.indexOf("@") + 1).toLowerCase();

    setBusy(true);
    setFormError(null);
    try {
      if (!(await prepareCredentials(domain))) return;

      await runTestSend({
        to,
        fromEmail: from,
        mergeTags: {
          ...testMergeValues,
          "contact.email": to,
        },
      });
      toast.success(`Test email sent to ${to}`);
      setTestOpen(false);
    } catch (err) {
      setFormError(err instanceof StudioApiError ? err.message : "Test send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" disabled={busy}>
              {triggerLabel}
              <ChevronDown className="size-4 opacity-70" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              resetNewsletterForm("draft");
              setNewsletterOpen(true);
            }}
          >
            <Mail className="size-4" />
            Create newsletter
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              resetNewsletterForm("schedule");
              setNewsletterOpen(true);
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
          <DropdownMenuItem
            onClick={() => {
              resetTestForm();
              setTestOpen(true);
            }}
          >
            <Send className="size-4" />
            Test send
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send test email</DialogTitle>
            <DialogDescription>
              Sends one message with this template’s current content. Nothing is saved to
              Newsletters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="hub-template-test-from">From</Label>
              <AccountCmdDropdown
                triggerId="hub-template-test-from"
                value={testFromEmail}
                onValueChange={(email) => setTestFromEmail(email ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hub-template-test-to">To</Label>
              <Input
                id="hub-template-test-to"
                type="email"
                placeholder={examplePlaceholder("you@example.com")}
                value={testToEmail}
                onChange={(e) => setTestToEmail(e.target.value)}
              />
            </div>
            {testMergeTagFields
              .filter((field) => mergeTagKey(field.token) !== "contact.email")
              .map((field) => {
                const key = mergeTagKey(field.token);
                return (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`hub-template-test-merge-${key}`}>{field.label}</Label>
                    <Input
                      id={`hub-template-test-merge-${key}`}
                      value={testMergeValues[key] ?? ""}
                      onChange={(e) =>
                        setTestMergeValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={examplePlaceholder(field.example)}
                    />
                  </div>
                );
              })}
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
        open={newsletterOpen}
        onOpenChange={(open) => {
          setNewsletterOpen(open);
          if (open) resetNewsletterForm(newsletterMode);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {newsletterMode === "schedule" ? "Schedule newsletter" : "Create newsletter"}
            </DialogTitle>
            <DialogDescription>
              {newsletterMode === "schedule"
                ? "New newsletter from this template, scheduled to send to the linked subscriber group."
                : "New draft newsletter with this template’s subject and body."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="hub-template-newsletter-audience">Subscriber group</Label>
              <SubscriberGroupCmdDropdown
                triggerId="hub-template-newsletter-audience"
                groups={subscriberGroups}
                loading={subscriberGroupsLoading}
                value={newsletterSubscriberGroupId || null}
                onValueChange={(id) => setNewsletterSubscriberGroupId(id ?? "")}
              />
            </div>
            {newsletterMode === "schedule" ? (
              <div className="space-y-1.5">
                <Label htmlFor="hub-template-schedule-at">Send at</Label>
                <Input
                  id="hub-template-schedule-at"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>
            ) : null}
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setNewsletterOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void handleCreateNewsletter()}>
              {busy
                ? "Working…"
                : newsletterMode === "schedule"
                  ? "Schedule newsletter"
                  : "Create newsletter"}
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
              <Label htmlFor="hub-template-trigger-name">Name</Label>
              <Input
                id="hub-template-trigger-name"
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
              <Label htmlFor="hub-template-trigger-sender">Sending account</Label>
              <AccountCmdDropdown
                triggerId="hub-template-trigger-sender"
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
