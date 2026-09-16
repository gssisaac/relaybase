"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TriggerStatusBadge } from "@/scale/components/triggers/TriggerStatusBadge";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";
import { scaleApi, ScaleApiError, type TriggerPurpose } from "@/lib/scale/api";

export function TriggerGeneralSettingsPanel() {
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
      const updated = await scaleApi.updateTrigger(triggerId, {
        name: name.trim(),
        description: description.trim() || null,
        purpose,
      });
      setTrigger(updated);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof ScaleApiError ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    try {
      const updated = await scaleApi.updateTrigger(triggerId, { listStatus: "archived" });
      setTrigger(updated);
      toast.success("Trigger archived");
    } catch {
      toast.error("Could not archive");
    }
  }

  if (!trigger) return null;

  const editable = trigger.listStatus !== "archived";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      {trigger ? (
        <div className="flex flex-wrap items-center gap-2">
          <TriggerStatusBadge status={trigger.status} listStatus={trigger.listStatus} />
          {trigger.lastTriggeredAt ? (
            <span className="text-xs text-muted-foreground">
              Last triggered{" "}
              {new Date(trigger.lastTriggeredAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="auto-name">Name</Label>
        <Input
          id="auto-name"
          value={name}
          disabled={!editable}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="auto-desc">Description</Label>
        <Input
          id="auto-desc"
          value={description}
          disabled={!editable}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Purpose</Label>
        <Select
          value={purpose}
          disabled={!editable}
          onValueChange={(v) => setPurpose(v as TriggerPurpose)}
        >
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

      <Button onClick={() => void saveSettings()} disabled={saving || !editable}>
        {saving ? "Saving…" : "Save settings"}
      </Button>

      {editable ? (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-semibold text-foreground">Archive</p>
          <p className="text-xs text-muted-foreground">
            Hide this trigger from the list and pause sends.
          </p>
          <Button variant="destructive" onClick={() => void archive()}>
            Archive trigger
          </Button>
        </div>
      ) : null}
    </div>
  );
}
