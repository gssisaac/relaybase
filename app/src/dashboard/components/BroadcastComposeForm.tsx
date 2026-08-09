"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Address, AudienceGroupSummary } from "@/email/components/types";

/**
 * Compose-shaped editor for broadcast drafts — same chrome as mail ComposeForm
 * (From / To / Subject / body / footer), with To showing audience groups.
 */
export function BroadcastComposeForm({
  sendFrom,
  setSendFrom,
  addresses,
  groups,
  selectedGroupIds,
  subject,
  setSubject,
  body,
  setBody,
  broadcasting,
  onBroadcast,
  draftStatus,
  onSaveDraft,
  saving,
}: {
  sendFrom: string;
  setSendFrom: (v: string) => void;
  addresses: Address[];
  groups: AudienceGroupSummary[];
  selectedGroupIds: string[];
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  broadcasting: boolean;
  onBroadcast: () => void;
  draftStatus?: string | null;
  onSaveDraft?: () => void;
  saving?: boolean;
}) {
  const selectedGroups = groups.filter((g) => selectedGroupIds.includes(g.id));
  const recipientCount = selectedGroups.reduce(
    (sum, g) => sum + g.contactCount,
    0,
  );
  const toLabel =
    selectedGroups.length > 0
      ? selectedGroups.map((g) => g.name).join(", ")
      : "No audience selected";

  const canBroadcast =
    !broadcasting &&
    !saving &&
    Boolean(sendFrom && subject.trim() && selectedGroupIds.length > 0);

  const handleSendHotkey = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (canBroadcast) onBroadcast();
  };

  return (
    <div
      data-allow-tab-focus
      onKeyDown={handleSendHotkey}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm"
    >
      <div className="flex shrink-0 flex-col divide-y divide-border/20 px-4">
        <div className="flex shrink-0 items-center gap-2 py-1">
          <span className="w-16 shrink-0 select-none text-xs font-medium text-muted-foreground">
            From:
          </span>
          <Select
            items={addresses.map((a) => {
              const name = a.displayName?.trim();
              return {
                value: a.email,
                label: name ? `${name} <${a.email}>` : a.email,
              };
            })}
            value={sendFrom || null}
            onValueChange={(next) => {
              if (next) setSendFrom(next);
            }}
            disabled={broadcasting || addresses.length === 0}
          >
            <SelectTrigger
              size="sm"
              className="h-8 shrink-0 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0 data-[size=sm]:h-8"
            >
              <SelectValue placeholder="Select account">
                {(value: string | null) => {
                  if (!value) return null;
                  const address = addresses.find((a) => a.email === value);
                  const name = address?.displayName?.trim();
                  return name ? `${name} <${value}>` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {addresses.map((address) => {
                const name = address.displayName?.trim();
                return (
                  <SelectItem key={address.email} value={address.email}>
                    {name ? `${name} <${address.email}>` : address.email}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex shrink-0 items-center py-1">
          <span className="w-16 shrink-0 select-none text-xs font-medium text-muted-foreground">
            To:
          </span>
          <div className="min-w-0 flex-1 py-1.5">
            <p className="truncate text-sm text-foreground">{toLabel}</p>
            <p className="truncate text-xs text-muted-foreground">
              {recipientCount} contact{recipientCount === 1 ? "" : "s"}
              {selectedGroups.length > 0
                ? ` · ${selectedGroups.length} group${selectedGroups.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center py-1">
          <span className="w-16 shrink-0 select-none text-xs font-medium text-muted-foreground">
            Subject:
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject..."
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-0"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleSendHotkey}
          placeholder="Write your message here..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="min-h-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-0"
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/20 bg-muted/10 px-4 py-3">
        <span className="select-none text-xs text-muted-foreground/60">
          {draftStatus ? draftStatus : "⌘Enter to broadcast"}
        </span>
        <div className="flex items-center gap-2">
          {onSaveDraft ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onSaveDraft}
              disabled={broadcasting || saving}
            >
              {saving ? "Saving…" : "Save draft"}
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={onBroadcast}
            disabled={!canBroadcast}
            className="px-4"
          >
            {broadcasting ? "Broadcasting…" : "Broadcast"}
          </Button>
        </div>
      </div>
    </div>
  );
}
