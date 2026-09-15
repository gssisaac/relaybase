"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkerDomains } from "@/crm/lib/use-worker-domains";
import { useAutomationDetail } from "@/crm/pages/automations/AutomationDetailContext";
import { crmApi, CrmApiError, type AutomationPurpose } from "@/lib/crm/api";

export function AutomationSettingsView() {
  const { automationId, automation, setAutomation } = useAutomationDetail();
  const { readyDomainNames } = useWorkerDomains();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [purpose, setPurpose] = useState<AutomationPurpose>("transactional");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!automation) return;
    setName(automation.name);
    setDescription(automation.description ?? "");
    setDomain(automation.domain);
    setFromName(automation.fromName ?? "");
    setFromEmail(automation.fromEmail ?? "");
    setReplyTo(automation.replyTo ?? "");
    setPurpose(automation.purpose);
  }, [automation]);

  async function saveSettings() {
    setSaving(true);
    try {
      const updated = await crmApi.updateAutomation(automationId, {
        name: name.trim(),
        description: description.trim() || null,
        domain: domain.trim().toLowerCase(),
        fromName: fromName.trim() || null,
        fromEmail: fromEmail.trim() || null,
        replyTo: replyTo.trim() || null,
        purpose,
      });
      setAutomation(updated);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof CrmApiError ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    try {
      const updated = await crmApi.updateAutomation(automationId, { listStatus: "archived" });
      setAutomation(updated);
      toast.success("Automation archived");
    } catch {
      toast.error("Could not archive");
    }
  }

  if (!automation) return null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Name, domain, and sender identity for this automation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auto-name">Name</Label>
            <Input id="auto-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-desc">Description</Label>
            <Input
              id="auto-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v as AutomationPurpose)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Domain</Label>
            <Select
              value={domain}
              onValueChange={(next) => setDomain(next ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([domain, ...readyDomainNames].filter(Boolean))].map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From name</Label>
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>From email</Label>
              <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reply-To</Label>
            <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Compliance footer identity is edited on the Content tab.
          </p>
          <Button onClick={() => void saveSettings()} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      {automation.listStatus !== "archived" ? (
        <Card>
          <CardHeader>
            <CardTitle>Archive</CardTitle>
            <CardDescription>Hide this automation from the list and pause sends.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => void archive()}>
              Archive automation
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
