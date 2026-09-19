"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { upsertMessageSidebarListRow } from "@/studio/lib/messages/message-sidebar-list";
import { studioApi } from "@/studio/api";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";

type NewMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (messageId: string) => void;
  trigger?: ReactElement;
};

export function NewMessageDialog({
  open,
  onOpenChange,
  onCreated,
  trigger,
}: NewMessageDialogProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function createMessageRow() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { message } = await studioApi.createMessage({ name });
      upsertMessageSidebarListRow(message);
      onOpenChange(false);
      setNewName("");
      onCreated(message.id);
    } catch {
      toast.error("Could not create message");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Reusable subject and body for newsletters and triggers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="template-name">Name</Label>
          <Input
            id="template-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={examplePlaceholder("Welcome email")}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            disabled={creating || !newName.trim()}
            onClick={() => void createMessageRow()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
