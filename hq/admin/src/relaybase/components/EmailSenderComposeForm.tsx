"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { EmailSenderKeyOption } from "./types";

export function EmailSenderComposeForm({
  keys,
  keyId,
  setKeyId,
  sendFrom,
  setSendFrom,
  sendFromName,
  setSendFromName,
  sendTo,
  setSendTo,
  sendSubject,
  setSendSubject,
  sendText,
  setSendText,
  sending,
  onSend,
}: {
  keys: EmailSenderKeyOption[];
  keyId: string;
  setKeyId: (v: string) => void;
  sendFrom: string;
  setSendFrom: (v: string) => void;
  sendFromName: string;
  setSendFromName: (v: string) => void;
  sendTo: string;
  setSendTo: (v: string) => void;
  sendSubject: string;
  setSendSubject: (v: string) => void;
  sendText: string;
  setSendText: (v: string) => void;
  sending: boolean;
  onSend: () => void;
}) {
  const selected = keys.find((k) => k.id === keyId);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">API key</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
          >
            <option value="">Select API key</option>
            {keys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.label ? `${key.label} · ` : ""}
                {key.domain}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">From name</Label>
          <Input
            value={sendFromName}
            onChange={(e) => setSendFromName(e.target.value)}
            placeholder="MacPurity"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">From</Label>
          <Input
            value={sendFrom}
            onChange={(e) => setSendFrom(e.target.value)}
            placeholder={
              selected ? `billing@${selected.domain}` : "billing@yourdomain.com"
            }
            className="h-10 font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">To</Label>
          <Input
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="recipient@example.com"
            className="h-10"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subject</Label>
        <Input
          value={sendSubject}
          onChange={(e) => setSendSubject(e.target.value)}
          className="h-10"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
        <Label className="text-xs">Message</Label>
        <Textarea
          value={sendText}
          onChange={(e) => setSendText(e.target.value)}
          rows={16}
          className="min-h-[280px] flex-1 resize-y"
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button
          size="sm"
          onClick={onSend}
          disabled={
            sending || !keyId || !sendFrom || !sendTo || !sendSubject || !sendText
          }
        >
          {sending ? "Sending…" : "Send test email"}
        </Button>
      </div>
    </div>
  );
}
