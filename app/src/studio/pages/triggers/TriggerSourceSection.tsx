"use client";

import { Check, Code2, Copy, Loader2, Pause, Play, RefreshCw, Send } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCheck } from "@/components/ui/field-check";
import { useTriggerDetail } from "@/studio/pages/triggers/TriggerDetailContext";
import { getStudioApiBase } from "@/lib/studio/api-base";
import { studioApi, StudioApiError, type TriggerSource } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

const COPY_URL_DISPLAY_CLASS =
  "flex h-8 min-w-0 flex-1 items-center truncate rounded-lg border border-border/80 bg-muted/40 px-2.5 font-mono text-xs text-foreground shadow-none dark:border-border/60 dark:bg-muted/20";

type CodeLanguage = "curl" | "typescript" | "python";

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
    "Idempotency-Key": randomUUID(), // Prevents duplicate sends on retries
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
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  const [cooldownSeconds, setCooldownSeconds] = useState(86_400);
  const [applySuppression, setApplySuppression] = useState(false);
  const [emailPath, setEmailPath] = useState("email");
  const [namePath, setNamePath] = useState("name");
  const [webhookSecretHint, setWebhookSecretHint] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<CodeLanguage>("curl");
  const [copiedLang, setCopiedLang] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setCooldownSeconds(trigger.cooldownSeconds);
    setApplySuppression(trigger.applyMarketingSuppression);
    const t = trigger.source;
    if (t.type === "http_webhook" || t.type === "form_submit") {
      setEmailPath(t.emailPath || "email");
      setNamePath(t.namePath ?? "name");
    }
    if (t.type === "http_webhook") {
      setWebhookSecretHint(t.secret.startsWith("••") ? null : t.secret);
    }
  }, [trigger]);

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

  function buildTriggerPatch(): TriggerSource {
    return {
      type: "http_webhook",
      secret: webhookSecretHint ?? (trigger?.source.type === "http_webhook" ? trigger.source.secret : "pending-rotate"),
      emailPath: emailPath.trim() || "email",
      namePath: namePath.trim() || "name",
      requiredFields: [],
    };
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

  function copySnippet() {
    const snippetText = snippets[selectedLang];
    void navigator.clipboard.writeText(snippetText);
    setCopiedLang(true);
    toast.success("Code snippet copied to clipboard");
    setTimeout(() => setCopiedLang(false), 2000);
  }

  if (!trigger) return null;

  const formBody = (
    <>
      {/* 1. Endpoint & Secret */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Webhook Endpoint</Label>
          <div className="flex gap-2">
            <div className={COPY_URL_DISPLAY_CLASS} title={webhookUrl}>
              {webhookUrl}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => {
                void navigator.clipboard.writeText(webhookUrl);
                toast.success("Webhook URL copied");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Bearer Secret Token</Label>
          <div className="flex flex-wrap items-center gap-2">
            {webhookSecretHint ? (
              <div className={cn(COPY_URL_DISPLAY_CLASS, "font-mono")}>
                {webhookSecretHint}
              </div>
            ) : (
              <div className={cn(COPY_URL_DISPLAY_CLASS, "text-muted-foreground")}>
                ••••••••••••••••••••••••••••••••
              </div>
            )}
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
                Copy
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => void rotateSecret()}>
              <RefreshCw className="mr-1.5 size-3.5" />
              Rotate secret
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Include <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">Authorization: Bearer &lt;token&gt;</code> in your webhook requests.
          </p>
        </div>
      </div>

      {/* 2. Payload Field Mapping */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3.5">
        <div>
          <h3 className="text-xs font-semibold text-foreground">Payload Field Mapping</h3>
          <p className="text-xs text-muted-foreground">
            Specify where the recipient email and name are located in your JSON payload. Dot notation is supported (e.g. <code className="rounded bg-muted px-1 font-mono text-[11px]">user.email</code>).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email-json-path" className="text-xs">Email JSON path</Label>
            <Input
              id="email-json-path"
              className="h-8 font-mono text-xs"
              value={emailPath}
              placeholder="email"
              onChange={(e) => setEmailPath(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name-json-path" className="text-xs">Name JSON path</Label>
            <Input
              id="name-json-path"
              className="h-8 font-mono text-xs"
              value={namePath}
              placeholder="name"
              onChange={(e) => setNamePath(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 3. Developer Integration Code Snippets */}
      <div className="space-y-2 rounded-lg border border-border bg-card p-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Code2 className="size-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">Quickstart Integration</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedLang("curl")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                selectedLang === "curl"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              cURL
            </button>
            <button
              type="button"
              onClick={() => setSelectedLang("typescript")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                selectedLang === "typescript"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Node / TS
            </button>
            <button
              type="button"
              onClick={() => setSelectedLang("python")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                selectedLang === "python"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Python
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="max-h-56 overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-foreground dark:bg-muted/40">
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
                Copy Code
              </>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Any field passed in your JSON payload can be used inside your email template via <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{trigger.fieldName}}"}</code>.
        </p>
      </div>

      {/* 4. Guardrails */}
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
          <p className="text-[11px] text-muted-foreground">
            Prevents duplicate sends to the same recipient within this window.
          </p>
        </div>
        <div className="flex flex-col justify-between pb-1">
          <FieldCheck
            id="apply-suppression"
            checked={applySuppression}
            onCheckedChange={(v) => setApplySuppression(Boolean(v))}
            label="Apply marketing suppression list"
          />
          <p className="text-[11px] text-muted-foreground">
            Skip recipients who have unsubscribed or bounced.
          </p>
        </div>
      </div>

      {/* 5. Action Buttons */}
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
            <CardTitle>HTTP Webhook Trigger</CardTitle>
            <CardDescription>
              Trigger 1:1 transactional emails by sending a JSON payload to your webhook endpoint.
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
              Sends this trigger once with sample trigger fields (verify URL, code, etc.).
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
