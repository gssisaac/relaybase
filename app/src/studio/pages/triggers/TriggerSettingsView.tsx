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
import { useTriggerDetail } from "@/studio/pages/triggers/TriggerDetailContext";
import { TriggerSourceSection } from "@/studio/pages/triggers/TriggerSourceSection";
import { studioApi, StudioApiError, type TriggerPurpose } from "@/lib/studio/api";

export function TriggerSettingsView() {
  const { triggerId, trigger, setTrigger } = useTriggerDetail();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState<TriggerPurpose>("transactional");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setName(trigger.name);
    setDescription(trigger.description ?? "");
    setPurpose(trigger.purpose);
  }, [trigger]);

  async function saveSettings() {
    setSaving(true);
    try {
      const updated = await studioApi.updateTrigger(triggerId, {
        name: name.trim(),
        description: description.trim() || null,
        purpose,
      });
      setTrigger(updated);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof StudioApiError ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    try {
      const updated = await studioApi.updateTrigger(triggerId, { listStatus: "archived" });
      setTrigger(updated);
      toast.success("Trigger archived");
    } catch {
      toast.error("Could not archive");
    }
  }

  if (!trigger) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Name and classification for this trigger.</CardDescription>
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
            <Select value={purpose} onValueChange={(v) => setPurpose(v as TriggerPurpose)}>
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

      <TriggerSourceSection />

      {trigger.listStatus !== "archived" ? (
        <Card>
          <CardHeader>
            <CardTitle>Archive</CardTitle>
            <CardDescription>Hide this trigger from the list and pause sends.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => void archive()}>
              Archive trigger
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
