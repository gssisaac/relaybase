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
import { AudienceGroupCmdDropdown } from "@/studio/components/AudienceGroupCmdDropdown";
import { NewsletterSendingProgressPanel } from "@/studio/components/newsletters/NewsletterSendingProgressPanel";
import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { studioAudienceDetailHref, newsletterDetailHref } from "@/studio/lib/paths";
import {
  useNewsletterDetail,
  useNewsletterDetailStore,
} from "@/studio/stores/newsletter-detail";
import { studioAudienceApi } from "@/studio/api";
import { useEmailPaths } from "@/email/lib/paths";

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

export function NewsletterPublishView() {
  const router = useRouter();
  const { newsletterId, newsletter } = useNewsletterDetail();
  const detailStore = useNewsletterDetailStore();
  const { apiBase } = useEmailPaths();

  const sending = detailStore.sendInFlight;
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
  const sendDispatch = detailStore.dispatch;

  const sendDomain = newsletter?.domain ?? newsletter?.audienceGroupDomain ?? null;

  useEffect(() => {
    if (!newsletter) return;
    const canPickAudience =
      newsletter.status === "draft" || newsletter.status === "scheduled";
    if (!canPickAudience || !sendDomain) return;
    setAudienceGroupsLoading(true);
    studioAudienceApi
      .listGroups()
      .then(({ groups }) => setAudienceGroups(groups))
      .catch(() => toast.error("Could not load subscriber groups"))
      .finally(() => setAudienceGroupsLoading(false));
  }, [newsletter, sendDomain]);

  const groupsForDomain = useMemo(() => {
    const d = sendDomain?.toLowerCase();
    if (!d) return [];
    return audienceGroups.filter((g) => g.domain.toLowerCase() === d);
  }, [audienceGroups, sendDomain]);

  if (!newsletter) return null;

  const canChangeAudience =
    newsletter.status === "draft" || newsletter.status === "scheduled";
  const editable = canChangeAudience;
  const recipientCount = newsletter.audienceActiveCount;
  const hasLinkedAudience = Boolean(newsletter.audienceGroupId);
  const canOpenSend =
    editable &&
    !sending &&
    Boolean(newsletter.subject.trim()) &&
    hasLinkedAudience &&
    recipientCount > 0;

  async function loadDialogContacts(groupId: string) {
    setDialogContactsLoading(true);
    setDialogContacts([]);
    try {
      const detail = await studioAudienceApi.getGroup(groupId);
      setDialogContacts(detail.contacts);
    } catch {
      toast.error("Could not load audience contacts");
      setAudienceContactsDialog(null);
    } finally {
      setDialogContactsLoading(false);
    }
  }

  function openAudienceChangeConfirm(nextGroupId: string) {
    if (nextGroupId === newsletter!.audienceGroupId) return;
    setAudienceContactsDialog({ mode: "confirm", groupId: nextGroupId });
    void loadDialogContacts(nextGroupId);
  }

  function openAudienceView() {
    const groupId = newsletter!.audienceGroupId;
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
      const result = await detailStore.updateAudienceGroup(audienceContactsDialog.groupId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      closeAudienceContactsDialog();
      toast.success("Subscriber group updated for this newsletter");
    } finally {
      setSavingAudience(false);
    }
  }

  const dialogGroupId = audienceContactsDialog?.groupId;
  const dialogGroup =
    dialogGroupId != null
      ? (groupsForDomain.find((g) => g.id === dialogGroupId) ??
        (newsletter.audienceGroupId === dialogGroupId
          ? {
              id: dialogGroupId,
              name: newsletter.audienceGroupName ?? "Subscriber group",
              domain: newsletter.audienceGroupDomain ?? sendDomain ?? "",
              contactCount: newsletter.audienceContactCount ?? dialogContacts.length,
              createdAt: "",
            }
          : undefined))
      : undefined;

  async function handleConfirmSend() {
    const domain = sendDomain?.trim();
    if (!domain) {
      toast.error("Select a sending domain on Settings before sending.");
      return;
    }

    setConfirmSendOpen(false);
    toast.success("Newsletter is sending — stats update as delivery progresses");
    router.push(newsletterDetailHref(newsletterId, "stats"));

    const result = await detailStore.sendNewsletter({ apiBase, sendingDomain: domain });
    if (!result.ok) {
      toast.error(result.error);
      setBlockedError(result.error ?? null);
    }
  }

  async function handleTestSend() {
    if (!testEmail.includes("@")) return;
    const domain = sendDomain?.trim();
    if (!domain) {
      toast.error("Select a sending domain on Settings before sending.");
      return;
    }
    const result = await detailStore.testSendNewsletter({
      apiBase,
      sendingDomain: domain,
      to: testEmail,
    });
    if (result.ok) {
      toast.success(`Test email sent to ${testEmail}`);
      setTestEmailOpen(false);
    } else {
      toast.error(result.error);
    }
  }

  async function handleSchedule() {
    if (!scheduleAt || new Date(scheduleAt).getTime() <= Date.now()) return;
    const domain = sendDomain?.trim();
    if (!domain) {
      toast.error("Select a sending domain on Settings before sending.");
      return;
    }
    const result = await detailStore.scheduleNewsletter({
      apiBase,
      sendingDomain: domain,
      runAt: new Date(scheduleAt).toISOString(),
    });
    if (result.ok) {
      setScheduleOpen(false);
      toast.success(`Newsletter scheduled for ${formatWhen(result.newsletter.scheduledAt)}`);
    } else {
      toast.error(result.error);
    }
  }

  async function handleCancelSchedule() {
    const result = await detailStore.cancelSchedule();
    if (result.ok) {
      toast.success("Schedule cancelled. Newsletter reverted to draft.");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Publish</h2>
        <p className="text-xs text-muted-foreground">
          Send to active newsletter audience members (late binding at send time).
        </p>
      </div>

      {newsletter.status === "sending" && sendDispatch ? (
        <NewsletterSendingProgressPanel
          dispatch={sendDispatch}
          action={
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={newsletterDetailHref(newsletterId, "stats")} />}
            >
              Live stats
            </Button>
          }
        />
      ) : newsletter.status === "sending" ? (
        <div className="flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs text-sky-800 dark:text-sky-300">
          <Loader2 className="size-4 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
          <span>
            Sending to {recipientCount.toLocaleString()} recipient
            {recipientCount === 1 ? "" : "s"}… loading queue status.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Subscriber group</CardTitle>
          <CardDescription>
            {canChangeAudience
              ? "Choose who receives this newsletter. Only groups on the same sending domain are listed."
              : "Linked subscriber group at send time (unsubscribed and bounced excluded)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canChangeAudience ? (
            <div className="space-y-1.5">
              <Label htmlFor="publish-audience">Subscriber group</Label>
              <div className="flex max-w-lg flex-wrap items-center gap-2">
                <AudienceGroupCmdDropdown
                  triggerId="publish-audience"
                  triggerClassName="min-w-0 flex-1"
                  groups={audienceGroups}
                  loading={audienceGroupsLoading}
                  domainFilter={sendDomain}
                  value={newsletter.audienceGroupId || null}
                  pinnedGroupIds={
                    newsletter.audienceGroupId ? [newsletter.audienceGroupId] : []
                  }
                  onValueChange={(value) => {
                    if (value) openAudienceChangeConfirm(value);
                  }}
                />
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
              {!sendDomain ? (
                <p className="text-sm text-muted-foreground">
                  Pick a subscriber group below, or set a sender on Settings to narrow the list to
                  one domain.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {newsletter.audienceGroupName ?? "Subscriber group"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {newsletter.audienceGroupDomain ?? sendDomain ?? "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {newsletter.audienceGroupId ? (
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
                        <Link href={studioAudienceDetailHref(newsletter.audienceGroupId)} />
                      }
                    >
                      <ExternalLink className="size-3.5" />
                      Open in Subscribers
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
            <NewsletterStatusBadge
              status={newsletter.status}
              listStatus={newsletter.listStatus}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Send</CardTitle>
          <CardDescription>
            {newsletter.status === "scheduled" && newsletter.scheduledAt
              ? `Scheduled for ${formatWhen(newsletter.scheduledAt)}`
              : newsletter.status === "sending"
                ? `Sending in progress since ${formatWhen(newsletter.sentAt)}`
                : newsletter.status === "sent"
                  ? `Sent ${formatWhen(newsletter.sentAt)}`
                  : "Save content first, then send or schedule from here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {editable ? (
            <Button size="sm" variant="outline" onClick={() => setTestEmailOpen(true)}>
              Send test
            </Button>
          ) : null}
          {newsletter.status === "scheduled" ? (
            <Button size="sm" variant="outline" onClick={() => void handleCancelSchedule()}>
              Cancel schedule
            </Button>
          ) : newsletter.status === "sending" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-sky-600 dark:text-sky-400">
                Dispatch in progress…
              </span>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={newsletterDetailHref(newsletterId, "stats")} />}
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
          {editable && !newsletter.subject.trim() ? (
            <p className="w-full text-xs text-muted-foreground">
              Add a subject on the Content tab before sending.
            </p>
          ) : null}
          {editable && newsletter.subject.trim() && !hasLinkedAudience ? (
            <p className="w-full text-xs text-muted-foreground">
              Select a subscriber group above before sending.
            </p>
          ) : null}
          {editable && hasLinkedAudience && recipientCount === 0 ? (
            <p className="w-full text-xs text-muted-foreground">
              Linked subscriber group has no active contacts — add subscribers in Subscribers or pick another
              group.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {newsletter.status === "sent" || newsletter.stats.sent > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">Send summary</CardTitle>
              <CardDescription>
                {newsletter.stats.delivered} delivered · {newsletter.stats.opened} opened ·{" "}
                {newsletter.stats.clicked} clicked
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={newsletterDetailHref(newsletterId, "stats")} />}
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
                ? "Switch subscriber group for this newsletter?"
                : dialogGroup
                  ? `Contacts in “${dialogGroup.name}”`
                  : "Group subscribers"}
            </DialogTitle>
            <DialogDescription>
              {dialogGroup
                ? audienceContactsDialog?.mode === "confirm"
                  ? `Send to “${dialogGroup.name}” on ${dialogGroup.domain} — ${dialogGroup.contactCount.toLocaleString()} contacts in the group. Review the list before confirming.`
                  : `${recipientCount.toLocaleString()} active subscriber${recipientCount === 1 ? "" : "s"} at send time (unsubscribed excluded).`
                : "Review subscribers in this group."}
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
                  {savingAudience ? "Saving…" : "Use this group"}
                </Button>
              </>
            ) : (
              <>
                {dialogGroupId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={studioAudienceDetailHref(dialogGroupId)} />}
                  >
                    Open in Subscribers
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
            <DialogTitle>Send &apos;{newsletter.subject || "Untitled draft"}&apos; immediately?</DialogTitle>
            <DialogDescription>
              This will send to {recipientCount.toLocaleString()} active recipient
              {recipientCount === 1 ? "" : "s"} in &apos;
              {newsletter.audienceGroupName ?? "the selected audience"}&apos;.
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
            <DialogTitle>Cannot send newsletter</DialogTitle>
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
              Schedule Newsletter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
