"use client";

import { Copy, Loader2, Pause, Play, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldCheck } from "@/components/ui/field-check";
import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import { sortAddressesByLocalPart } from "@/email/lib/accounts/enabled-accounts";
import { useTriggerDetail } from "@/studio/pages/triggers/TriggerDetailContext";
import { getStudioApiBase } from "@/lib/studio/api-base";
import { studioApi, StudioApiError, type TriggerSource } from "@/lib/studio/api";

const COPY_URL_DISPLAY_CLASS =
  "flex h-8 min-w-0 flex-1 items-center truncate rounded-lg border border-border/80 bg-muted/40 px-2.5 font-mono text-xs text-foreground shadow-none dark:border-border/60 dark:bg-muted/20";

function inboundEmailFromTrigger(source: Extract<TriggerSource, { type: "mailbox_inbound" }>) {
  return `${source.localPart}@${source.domain}`.toLowerCase();
}

function triggerTypeLabel(type: TriggerSource["type"]): string {
  switch (type) {
    case "internal_event":
      return "Internal event";
    case "form_submit":
      return "Form submit";
    case "http_webhook":
      return "HTTP webhook";
    case "mailbox_inbound":
      return "Mailbox inbound";
    default:
      return type;
  }
}

export function TriggerSourceSection({ embedded }: { embedded?: boolean } = {}) {
  const { triggerId, trigger, setTrigger, refresh } = useTriggerDetail();
  const {
    availableAddresses,
    loading: addressesLoading,
    error: addressesError,
    refreshAddresses,
  } = useMailAccounts();
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  const [triggerType, setTriggerType] = useState<TriggerSource["type"]>("internal_event");
  const [cooldownSeconds, setCooldownSeconds] = useState(86_400);
  const [applySuppression, setApplySuppression] = useState(false);

  const [formKey, setFormKey] = useState("contact");
  const [emailPath, setEmailPath] = useState("email");
  const [namePath, setNamePath] = useState("name");
  const [internalEvent, setInternalEvent] = useState<"account.verify_email" | "account.created">(
    "account.verify_email",
  );
  const [inboundAccountEmail, setInboundAccountEmail] = useState("");
  const [webhookSecretHint, setWebhookSecretHint] = useState<string | null>(null);

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  useEffect(() => {
    if (!trigger) return;
    setTriggerType(trigger.source.type);
    setCooldownSeconds(trigger.cooldownSeconds);
    setApplySuppression(trigger.applyMarketingSuppression);
    const t = trigger.source;
    if (t.type === "form_submit") {
      setFormKey(t.formKey);
      setEmailPath(t.emailPath);
      setNamePath(t.namePath ?? "name");
    }
    if (t.type === "internal_event") setInternalEvent(t.event);
    if (t.type === "mailbox_inbound") {
      setInboundAccountEmail(inboundEmailFromTrigger(t));
    }
    if (t.type === "http_webhook") {
      setEmailPath(t.emailPath);
      setNamePath(t.namePath ?? "name");
      setWebhookSecretHint(t.secret.startsWith("••") ? null : t.secret);
    }
  }, [trigger]);

  const inboundAccountCandidates = useMemo(() => {
    const inboundCapable = availableAddresses.filter((a) => a.inboundEnabled !== false);
    return sortAddressesByLocalPart(inboundCapable);
  }, [availableAddresses]);

  const inboundAccountEmails = useMemo(
    () => new Set(inboundAccountCandidates.map((a) => a.email.toLowerCase())),
    [inboundAccountCandidates],
  );

  const inboundAccountValue = inboundAccountEmail.trim().toLowerCase() || null;

  const selectedInboundAccountEmail =
    inboundAccountValue && inboundAccountEmails.has(inboundAccountValue)
      ? inboundAccountValue
      : null;

  const hasInboundAccounts = inboundAccountCandidates.length > 0;

  const webhookUrl = useMemo(() => {
    if (!trigger) return "";
    return `${getStudioApiBase()}/studio/hooks/trigger/${trigger.id}`;
  }, [trigger]);

  const formHookUrl = useMemo(() => {
    if (!trigger || trigger.source.type !== "form_submit") return "";
    const key = trigger.source.formKey;
    return `${getStudioApiBase()}/studio/hooks/form/${encodeURIComponent(key)}`;
  }, [trigger]);

  function resolveInboundMailbox(): { domain: string; localPart: string } | null {
    const email =
      inboundAccountEmail.trim().toLowerCase() ||
      (trigger?.source.type === "mailbox_inbound"
        ? inboundEmailFromTrigger(trigger.source)
        : "");
    const at = email.indexOf("@");
    if (at <= 0) return null;
    return {
      localPart: email.slice(0, at).trim() || "hello",
      domain: email.slice(at + 1).trim().toLowerCase(),
    };
  }

  function buildTriggerPatch(): TriggerSource {
    switch (triggerType) {
      case "http_webhook":
        if (trigger?.source.type === "http_webhook") {
          return {
            ...trigger.source,
            emailPath: emailPath.trim() || "email",
            namePath: namePath.trim() || "name",
          };
        }
        return {
          type: "http_webhook",
          secret: webhookSecretHint ?? "pending-rotate",
          emailPath: emailPath.trim() || "email",
          namePath: namePath.trim() || "name",
          requiredFields: [],
        };
      case "form_submit":
        return {
          type: "form_submit",
          formKey: formKey.trim() || "contact",
          emailPath: emailPath.trim() || "email",
          namePath: namePath.trim() || "name",
          requiredFields: ["message"],
        };
      case "mailbox_inbound": {
        const mailbox = resolveInboundMailbox();
        return {
          type: "mailbox_inbound",
          domain: mailbox?.domain ?? trigger?.domain?.trim().toLowerCase() ?? "",
          localPart: mailbox?.localPart ?? "hello",
          replyToSender: true,
          match: null,
        };
      }
      case "internal_event":
      default:
        return { type: "internal_event", event: internalEvent };
    }
  }

  async function saveTrigger() {
    if (!trigger) return;
    setSaving(true);
    try {
      const patch = buildTriggerPatch();
      let updated = await studioApi.updateTrigger(triggerId, {
        source: patch,
        cooldownSeconds,
        applyMarketingSuppression: applySuppression,
      });
      if (patch.type === "http_webhook" && patch.secret === "pending-rotate") {
        const rotated = await studioApi.rotateTriggerWebhookSecret(triggerId);
        updated = rotated.trigger;
        setWebhookSecretHint(rotated.secret);
      }
      setTrigger(updated);
      toast.success("Trigger settings saved");
    } catch (e) {
      toast.error(e instanceof StudioApiError ? e.message : "Could not save trigger");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      await saveTrigger();
      const updated = await studioApi.activateTrigger(triggerId);
      setTrigger(updated);
      toast.success("Trigger is active");
    } catch (e) {
      const issues =
        e instanceof StudioApiError && Array.isArray(e.body?.issues)
          ? (e.body!.issues as { message: string }[])
          : null;
      toast.error(
        issues?.map((i) => i.message).join(" · ") ??
          (e instanceof StudioApiError ? e.message : "Could not activate"),
      );
    } finally {
      setActivating(false);
    }
  }

  async function handlePause() {
    try {
      const updated = await studioApi.pauseTrigger(triggerId);
      setTrigger(updated);
      toast.success("Trigger paused");
    } catch {
      toast.error("Could not pause trigger");
    }
  }

  async function rotateSecret() {
    try {
      const res = await studioApi.rotateTriggerWebhookSecret(triggerId);
      setTrigger(res.trigger);
      setWebhookSecretHint(res.secret);
      toast.success("Webhook secret rotated");
    } catch {
      toast.error("Could not rotate secret");
    }
  }

  async function sendTest() {
    const email = testEmail.trim();
    if (!email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setTestSending(true);
    try {
      await studioApi.testSendTrigger(triggerId, { email, name: "Test User" });
      toast.success("Test email sent");
      setTestOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof StudioApiError ? e.message : "Test send failed");
    } finally {
      setTestSending(false);
    }
  }

  if (!trigger) return null;

  const formBody = (
    <>
          <div className="space-y-2">
            <Label>Trigger type</Label>
            <Select
              value={triggerType}
              onValueChange={(v) => setTriggerType(v as TriggerSource["type"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select trigger type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal_event">Internal event</SelectItem>
                <SelectItem value="form_submit">Form submit</SelectItem>
                <SelectItem value="http_webhook">HTTP webhook</SelectItem>
                <SelectItem value="mailbox_inbound">Mailbox inbound</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{triggerTypeLabel(triggerType)}</p>
          </div>

          {triggerType === "internal_event" ? (
            <div className="space-y-2">
              <Label>Event</Label>
              <Select
                value={internalEvent}
                onValueChange={(v) =>
                  setInternalEvent(v as "account.verify_email" | "account.created")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account.verify_email">account.verify_email</SelectItem>
                  <SelectItem value="account.created">account.created</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Fire via{" "}
                <code className="rounded bg-muted px-1">
                  POST /studio/triggers/fire/internal/{internalEvent}
                </code>{" "}
                (Studio API auth).
              </p>
            </div>
          ) : null}

          {triggerType === "form_submit" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="form-key">Form key</Label>
                <Input id="form-key" value={formKey} onChange={(e) => setFormKey(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-path">Email JSON path</Label>
                <Input
                  id="email-path"
                  value={emailPath}
                  onChange={(e) => setEmailPath(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name-path">Name JSON path</Label>
                <Input
                  id="name-path"
                  value={namePath}
                  onChange={(e) => setNamePath(e.target.value)}
                />
              </div>
              {formHookUrl ? (
                <div className="space-y-1 sm:col-span-2">
                  <Label>Endpoint</Label>
                  <div className="flex gap-2">
                    <div className={COPY_URL_DISPLAY_CLASS} title={formHookUrl}>
                      {formHookUrl}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        void navigator.clipboard.writeText(formHookUrl);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uses the same Studio webhook secret as bounce webhooks.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {triggerType === "http_webhook" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <div className={COPY_URL_DISPLAY_CLASS} title={webhookUrl}>
                    {webhookUrl}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      void navigator.clipboard.writeText(webhookUrl);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email JSON path</Label>
                  <Input value={emailPath} onChange={(e) => setEmailPath(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Name JSON path</Label>
                  <Input value={namePath} onChange={(e) => setNamePath(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void rotateSecret()}>
                  Rotate secret
                </Button>
                {webhookSecretHint ? (
                  <code className="rounded bg-muted px-2 py-1 text-xs">{webhookSecretHint}</code>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Bearer token hidden — rotate to reveal a new secret.
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {triggerType === "mailbox_inbound" ? (
            <div className="space-y-2">
              {addressesError ? (
                <p className="text-sm text-destructive">{addressesError}</p>
              ) : null}
              {addressesLoading ? (
                <p className="text-sm text-muted-foreground">Loading addresses…</p>
              ) : !hasInboundAccounts ? (
                <p className="text-sm text-muted-foreground">
                  No inbound addresses available. Add a sender under Dashboard → Accounts first.
                </p>
              ) : (
                <>
                  <Label htmlFor="inbound-account">Account</Label>
                  <AccountCmdDropdown
                    triggerId="inbound-account"
                    triggerClassName="min-w-0"
                    addresses={inboundAccountCandidates}
                    autoRefresh={false}
                    pinnedEmails={[inboundAccountEmail]}
                    value={selectedInboundAccountEmail}
                    required
                    onValueChange={(value) => setInboundAccountEmail(value ?? "")}
                  />
                </>
              )}
              <p className="text-xs text-muted-foreground">
                When someone emails the selected inbox, the Worker posts to{" "}
                <code className="rounded bg-muted px-1">POST /studio/hooks/inbound</code> with
                domain, localPart, and fromEmail.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown (seconds)</Label>
              <Input
                id="cooldown"
                type="number"
                min={0}
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end pb-1">
              <FieldCheck
                id="apply-suppression"
                checked={applySuppression}
                onCheckedChange={(v) => setApplySuppression(Boolean(v))}
                label="Apply marketing suppression list"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={() => void saveTrigger()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save trigger"
              )}
            </Button>
            {trigger.status === "active" ? (
              <Button type="button" variant="outline" onClick={() => void handlePause()}>
                <Pause className="mr-2 size-4" />
                Pause
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleActivate()} disabled={activating}>
                {activating ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Activating…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 size-4" />
                    Activate
                  </>
                )}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setTestOpen(true)}>
              <Send className="mr-2 size-4" />
              Test send
            </Button>
          </div>
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="space-y-4">{formBody}</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Trigger</CardTitle>
            <CardDescription>
              Choose what starts this trigger. Only one active trigger should match each trigger
              key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">{formBody}</CardContent>
        </Card>
      )}

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test send</DialogTitle>
            <DialogDescription>
              Sends this trigger once with sample trigger fields (verify URL, message, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="test-email">Recipient email</Label>
            <Input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void sendTest()} disabled={testSending}>
              {testSending ? "Sending…" : "Send test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
