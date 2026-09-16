"use client";

import { Check, Code2, Copy, Inbox, Loader2, Pause, Play, RefreshCw, Send, Webhook } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { FieldCheck } from "@/components/ui/field-check";
import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import { sortAddressesByLocalPart } from "@/email/lib/accounts/enabled-accounts";
import { useTriggerDetail } from "@/studio/pages/triggers/TriggerDetailContext";
import { getStudioApiBase } from "@/lib/studio/api-base";
import { studioApi, StudioApiError, type TriggerSource } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

const COPY_URL_DISPLAY_CLASS =
  "flex h-8 min-w-0 flex-1 items-center truncate rounded-lg border border-border/80 bg-muted/40 px-2.5 font-mono text-xs text-foreground shadow-none dark:border-border/60 dark:bg-muted/20";

type CodeLanguage = "curl" | "typescript" | "python";

function inboundEmailFromTrigger(source: Extract<TriggerSource, { type: "mailbox_inbound" }>) {
  return `${source.localPart}@${source.domain}`.toLowerCase();
}

function triggerTypeDescription(type: TriggerSource["type"]): string {
  if (type === "mailbox_inbound") {
    return "When someone emails your selected inbox, Relaybase sends this template back to the sender. No backend code required.";
  }
  return "Call the webhook from your app when something happens (signup, reset password, receipt). Send JSON; we send one email to the recipient.";
}

function triggerTypeSelectLabel(type: TriggerSource["type"]): string {
  return type === "mailbox_inbound" ? "Mailbox inbound" : "HTTP webhook";
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return;
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function generateSnippets(params: {
  url: string;
  secret: string;
  emailPath: string;
  namePath: string;
}) {
  const { url, secret, emailPath, namePath } = params;
  const token = secret && !secret.startsWith("••") ? secret : "YOUR_WEBHOOK_SECRET";

  const sampleBody: Record<string, unknown> = {};
  const ePath = emailPath.trim() || "email";
  const nPath = namePath.trim() || "name";

  setNestedValue(sampleBody, ePath, "alex@example.com");
  setNestedValue(sampleBody, nPath, "Alex Kim");
  sampleBody.verifyUrl = "https://yourdomain.com/verify?token=xyz123";
  sampleBody.code = "849201";

  const jsonString = JSON.stringify(sampleBody, null, 2);

  const curl = `curl -X POST "${url}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: evt_$(date +%s)" \\
  -d '${jsonString}'`;

  const typescript = `import { randomUUID } from "node:crypto";

await fetch("${url}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json",
    "Idempotency-Key": randomUUID(), // Prevents duplicate sends
  },
  body: JSON.stringify(${jsonString}),
});`;

  const python = `import uuid
import requests

url = "${url}"
headers = {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json",
    "Idempotency-Key": str(uuid.uuid4()),
}
payload = ${jsonString.replace(/true/g, "True").replace(/false/g, "False").replace(/null/g, "None")}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())`;

  return { curl, typescript, python };
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
  const [testName, setTestName] = useState("Alex Kim");
  const [testSending, setTestSending] = useState(false);

  const [triggerType, setTriggerType] = useState<TriggerSource["type"]>("http_webhook");
  const [cooldownSeconds, setCooldownSeconds] = useState(86_400);
  const [applySuppression, setApplySuppression] = useState(false);

  const [emailPath, setEmailPath] = useState("email");
  const [namePath, setNamePath] = useState("name");
  const [webhookSecretHint, setWebhookSecretHint] = useState<string | null>(null);
  const [inboundAccountEmail, setInboundAccountEmail] = useState("");

  const [selectedLang, setSelectedLang] = useState<CodeLanguage>("curl");
  const [copiedLang, setCopiedLang] = useState(false);
  const [integrationOpen, setIntegrationOpen] = useState(false);

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  useEffect(() => {
    if (!trigger) return;
    setTriggerType(trigger.source.type);
    setCooldownSeconds(trigger.cooldownSeconds);
    setApplySuppression(trigger.applyMarketingSuppression);
    const t = trigger.source;
    if (t.type === "http_webhook") {
      setEmailPath(t.emailPath || "email");
      setNamePath(t.namePath ?? "name");
      setWebhookSecretHint(t.secret.startsWith("••") ? null : t.secret);
    }
    if (t.type === "mailbox_inbound") {
      setInboundAccountEmail(inboundEmailFromTrigger(t));
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

  const snippets = useMemo(() => {
    return generateSnippets({
      url: webhookUrl,
      secret: webhookSecretHint ?? "",
      emailPath,
      namePath,
    });
  }, [webhookUrl, webhookSecretHint, emailPath, namePath]);

  const samplePayloadJson = useMemo(() => {
    const sampleBody: Record<string, unknown> = {};
    setNestedValue(sampleBody, emailPath.trim() || "email", "alex@example.com");
    setNestedValue(sampleBody, namePath.trim() || "name", "Alex Kim");
    sampleBody.verifyUrl = "https://yourdomain.com/verify?token=xyz123";
    sampleBody.code = "849201";
    return JSON.stringify(sampleBody, null, 2);
  }, [emailPath, namePath]);

  function resolveInboundMailbox(): { domain: string; localPart: string } | null {
    const email =
      inboundAccountEmail.trim().toLowerCase() ||
      (trigger?.source.type === "mailbox_inbound"
        ? inboundEmailFromTrigger(trigger.source)
        : "");
    const at = email.indexOf("@");
    if (at <= 0) return null;
    return {
      localPart: email.slice(0, at).trim() || "support",
      domain: email.slice(at + 1).trim().toLowerCase(),
    };
  }

  async function saveTrigger() {
    if (!trigger) return;
    setSaving(true);
    try {
      let patch: TriggerSource;
      if (triggerType === "mailbox_inbound") {
        const mailbox = resolveInboundMailbox();
        patch = {
          type: "mailbox_inbound",
          domain: mailbox?.domain ?? trigger?.domain?.trim().toLowerCase() ?? "",
          localPart: mailbox?.localPart ?? "support",
          replyToSender: true,
          match: null,
        };
      } else {
        patch = {
          type: "http_webhook",
          secret: webhookSecretHint ?? (trigger.source.type === "http_webhook" ? trigger.source.secret : "pending-rotate"),
          emailPath: emailPath.trim() || "email",
          namePath: namePath.trim() || "name",
          requiredFields: [],
        };
      }

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
      const samplePayload =
        triggerType === "mailbox_inbound"
          ? {
              fromEmail: email,
              fromName: testName.trim() || "Test User",
              subject: "Sample Inquiry Subject",
              snippet: "Hello, I am asking about your service setup and pricing.",
            }
          : {
              email,
              name: testName.trim() || "Test User",
              verifyUrl: "https://yourdomain.com/verify?token=test_preview",
              code: "849201",
            };

      await studioApi.testSendTrigger(triggerId, {
        email,
        name: testName.trim() || "Test User",
        payload: samplePayload,
      });
      toast.success("Test email sent");
      setTestOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof StudioApiError ? e.message : "Test send failed");
    } finally {
      setTestSending(false);
    }
  }

  function copySnippet() {
    const snippetText = snippets[selectedLang];
    void navigator.clipboard.writeText(snippetText);
    setCopiedLang(true);
    toast.success("Code snippet copied to clipboard");
    setTimeout(() => setCopiedLang(false), 2000);
  }

  if (!trigger) return null;

  const formContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Trigger source</Label>
        <Select
          value={triggerType}
          onValueChange={(v) => {
            if (v !== "http_webhook" && v !== "mailbox_inbound") return;
            setTriggerType(v);
            if (v === "mailbox_inbound" && cooldownSeconds === 86_400) {
              setCooldownSeconds(3600);
            }
            if (v === "http_webhook" && cooldownSeconds === 3600) {
              setCooldownSeconds(86_400);
            }
          }}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue>
              {(value) => {
                const type = (value ?? triggerType) as TriggerSource["type"];
                const Icon = type === "mailbox_inbound" ? Inbox : Webhook;
                return (
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                    {triggerTypeSelectLabel(type)}
                  </span>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="http_webhook" label="HTTP webhook">
              <span className="flex items-center gap-2">
                <Webhook className="size-4 text-primary" aria-hidden />
                HTTP webhook
              </span>
            </SelectItem>
            <SelectItem value="mailbox_inbound" label="Mailbox inbound">
              <span className="flex items-center gap-2">
                <Inbox className="size-4 text-primary" aria-hidden />
                Mailbox inbound
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {triggerTypeDescription(triggerType)}
        </p>
      </div>

      {triggerType === "http_webhook" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Webhook</Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto gap-1 px-0 text-xs font-medium"
              onClick={() => setIntegrationOpen(true)}
            >
              <Code2 className="size-3.5" aria-hidden />
              Integration
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className={COPY_URL_DISPLAY_CLASS} title={webhookUrl}>
                {webhookUrl}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="Copy webhook URL"
                onClick={() => {
                  void navigator.clipboard.writeText(webhookUrl);
                  toast.success("Webhook URL copied");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={cn(
                  COPY_URL_DISPLAY_CLASS,
                  !webhookSecretHint && "text-muted-foreground",
                )}
                title={webhookSecretHint ?? "Secret hidden until rotated"}
              >
                {webhookSecretHint ?? "••••••••••••••••••••••••••••••••"}
              </div>
              {webhookSecretHint ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(webhookSecretHint);
                    toast.success("Secret copied");
                  }}
                >
                  <Copy className="mr-1.5 size-3.5" />
                  Copy secret
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => void rotateSecret()}>
                <RefreshCw className="mr-1.5 size-3.5" />
                {webhookSecretHint ? "Rotate" : "Reveal secret"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="inbound-account">Inbound mailbox</Label>
          {addressesError ? (
            <p className="text-xs text-destructive">{addressesError}</p>
          ) : null}
          {addressesLoading ? (
            <p className="text-xs text-muted-foreground">Loading addresses…</p>
          ) : !hasInboundAccounts ? (
            <p className="text-xs text-muted-foreground">
              No inbound addresses yet. Add one under Dashboard → Accounts.
            </p>
          ) : (
            <AccountCmdDropdown
              triggerId="inbound-account"
              triggerClassName="min-w-0 w-full"
              addresses={inboundAccountCandidates}
              autoRefresh={false}
              pinnedEmails={[inboundAccountEmail]}
              value={selectedInboundAccountEmail}
              required
              onValueChange={(value) => setInboundAccountEmail(value ?? "")}
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            Use{" "}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">{"{{trigger.subject}}"}</code>,{" "}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">{"{{trigger.fromName}}"}</code>{" "}
            in your template for the incoming message.
          </p>
        </div>
      )}

      <Accordion>
        <AccordionItem value="advanced" className="border-border/60">
          <AccordionTrigger className="py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            Advanced
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1">
            {triggerType === "http_webhook" ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email-json-path" className="text-xs">
                    Email JSON path
                  </Label>
                  <Input
                    id="email-json-path"
                    className="h-8 font-mono text-xs"
                    value={emailPath}
                    placeholder="email"
                    onChange={(e) => setEmailPath(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name-json-path" className="text-xs">
                    Name JSON path
                  </Label>
                  <Input
                    id="name-json-path"
                    className="h-8 font-mono text-xs"
                    value={namePath}
                    placeholder="name"
                    onChange={(e) => setNamePath(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cooldown" className="text-xs">
                  Cooldown (seconds)
                </Label>
                <Input
                  id="cooldown"
                  type="number"
                  min={0}
                  className="h-8 font-mono text-xs"
                  value={cooldownSeconds}
                  onChange={(e) => setCooldownSeconds(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-end pb-0.5">
                <FieldCheck
                  id="apply-suppression"
                  checked={applySuppression}
                  onCheckedChange={(v) => setApplySuppression(Boolean(v))}
                  label="Apply marketing suppression"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );

  const formFooter = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => void saveTrigger()} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-1.5 size-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save trigger"
        )}
      </Button>
      {trigger.status === "active" ? (
        <Button type="button" variant="outline" onClick={() => void handlePause()}>
          <Pause className="mr-1.5 size-4" />
          Pause
        </Button>
      ) : (
        <Button type="button" onClick={() => void handleActivate()} disabled={activating}>
          {activating ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Activating…
            </>
          ) : (
            <>
              <Play className="mr-1.5 size-4" />
              Activate
            </>
          )}
        </Button>
      )}
      <Button type="button" variant="outline" onClick={() => setTestOpen(true)}>
        <Send className="mr-1.5 size-4" />
        Test send
      </Button>
    </div>
  );

  return (
    <>
      {embedded ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">{formContent}</div>
          <div className="shrink-0 border-t border-border bg-background pt-3">{formFooter}</div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Trigger Settings</CardTitle>
            <CardDescription>
              Configure webhook or mailbox inbound event source for this automated email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formContent}
            <div className="border-t border-border pt-3">{formFooter}</div>
          </CardContent>
        </Card>
      )}

      <Dialog open={integrationOpen} onOpenChange={setIntegrationOpen}>
        <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>Integration guide</DialogTitle>
            <DialogDescription>
              Connect your backend to this trigger with a single POST request. Save trigger settings
              first so field paths match your payload.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
            <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
              <li>
                Copy the <strong className="font-medium text-foreground">webhook URL</strong> and{" "}
                <strong className="font-medium text-foreground">Bearer secret</strong> from the
                trigger panel (rotate secret if hidden).
              </li>
              <li>
                From your server, send a <code className="rounded bg-muted px-1 font-mono text-xs">POST</code>{" "}
                with <code className="rounded bg-muted px-1 font-mono text-xs">Content-Type: application/json</code>{" "}
                and header{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">Authorization: Bearer …</code>.
              </li>
              <li>
                Include recipient fields at{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">{emailPath || "email"}</code> and{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">{namePath || "name"}</code> (or
                change paths under Advanced).
              </li>
              <li>
                Reference any JSON key in the email body as{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">{"{{trigger.fieldName}}"}</code>{" "}
                (nested keys use dots, e.g.{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">{"{{trigger.user.id}}"}</code>).
              </li>
              <li>
                Optional: send{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">Idempotency-Key</code> to
                avoid duplicate sends on retries.
              </li>
            </ol>

            <div className="space-y-1.5">
              <Label className="text-xs">Example JSON body</Label>
              <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {samplePayloadJson}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">Sample request</Label>
                <div className="flex items-center gap-1">
                  {(["curl", "typescript", "python"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedLang(lang)}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                        selectedLang === lang
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {lang === "curl" ? "cURL" : lang === "typescript" ? "Node / TS" : "Python"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 pr-24 font-mono text-[11px] leading-relaxed">
                  <code>{snippets[selectedLang]}</code>
                </pre>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2 h-7 px-2 text-xs"
                  onClick={copySnippet}
                >
                  {copiedLang ? (
                    <>
                      <Check className="mr-1 size-3 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 size-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setIntegrationOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test send trigger</DialogTitle>
            <DialogDescription>
              {triggerType === "mailbox_inbound"
                ? "Simulate receiving an inbound email to test your auto-reply delivery."
                : "Send a live test email with sample webhook payload values."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="test-email">Recipient email</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test-name">Recipient name</Label>
              <Input
                id="test-name"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Alex Kim"
              />
            </div>
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
