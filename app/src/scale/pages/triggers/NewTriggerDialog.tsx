"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import { Button } from "@/components/ui/button";
import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertTriggerSidebarListRow } from "@/scale/lib/triggers/trigger-sidebar-list";
import { scaleApi, ScaleApiError, type TriggerPurpose } from "@/lib/scale/api";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";

type NewTriggerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (triggerId: string) => void;
  trigger?: ReactElement;
};

export function NewTriggerDialog({
  open,
  onOpenChange,
  onCreated,
  trigger,
}: NewTriggerDialogProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSenderEmail, setNewSenderEmail] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState<string | null>(null);
  const [newPurpose, setNewPurpose] = useState<TriggerPurpose>("transactional");

  function resetForm() {
    setNewName("");
    setNewSenderEmail(null);
    setNewDomain(null);
    setNewPurpose("transactional");
    setCreating(false);
  }

  async function handleCreate() {
    const name = newName.trim();
    const domain = newDomain?.trim().toLowerCase();
    if (!name || !domain) {
      toast.error("Name and sending account are required");
      return;
    }
    setCreating(true);
    try {
      const created = await scaleApi.createTrigger({ name, domain, purpose: newPurpose });
      upsertTriggerSidebarListRow(created);
      onOpenChange(false);
      resetForm();
      onCreated(created.id);
    } catch (e) {
      toast.error(e instanceof ScaleApiError ? e.message : "Could not create trigger");
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New trigger</DialogTitle>
          <DialogDescription>
            One trigger, one email — verify links, form replies, or inbox auto-responses.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="trigger-name">Name</Label>
            <Input
              id="trigger-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={examplePlaceholder("Verify Email")}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Purpose</Label>
            <CmdDropdown
              triggerClassName="min-w-0"
              value={newPurpose}
              enableSearch={false}
              options={[
                { value: "transactional", label: "Transactional" },
                { value: "conversational", label: "Conversational" },
                { value: "marketing", label: "Marketing" },
              ]}
              onValueChange={(v) => {
                if (v === "transactional" || v === "conversational" || v === "marketing") {
                  setNewPurpose(v);
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trigger-create-sender">Sending account</Label>
            <AccountCmdDropdown
              triggerId="trigger-create-sender"
              triggerClassName="min-w-0"
              value={newSenderEmail}
              onValueChange={(email, ctx) => {
                setNewSenderEmail(email ?? null);
                setNewDomain(ctx?.domain ?? null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Sending domain is taken from the account you pick.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            disabled={creating || !newName.trim() || !newDomain?.trim()}
            onClick={() => void handleCreate()}
          >
            {creating ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
