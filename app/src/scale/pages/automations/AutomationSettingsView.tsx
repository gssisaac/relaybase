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
import { useAutomationDetail } from "@/scale/pages/automations/AutomationDetailContext";
import { AutomationTriggerSection } from "@/scale/pages/automations/AutomationTriggerSection";
import { scaleApi, ScaleApiError, type AutomationPurpose } from "@/lib/scale/api";

export function AutomationSettingsView() {
  const { automationId, automation, setAutomation } = useAutomationDetail();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState<AutomationPurpose>("transactional");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!automation) return;
    setName(automation.name);
    setDescription(automation.description ?? "");
    setPurpose(automation.purpose);
  }, [automation]);

  async function saveSettings() {
    setSaving(true);
    try {
      const updated = await scaleApi.updateAutomation(automationId, {
        name: name.trim(),
        description: description.trim() || null,
        purpose,
      });
      setAutomation(updated);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof ScaleApiError ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    try {
      const updated = await scaleApi.updateAutomation(automationId, { listStatus: "archived" });
      setAutomation(updated);
      toast.success("Automation archived");
    } catch {
      toast.error("Could not archive");
    }
  }

  if (!automation) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Name and classification for this automation.</CardDescription>
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
          <Button onClick={() => void saveSettings()} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      <AutomationTriggerSection />

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
