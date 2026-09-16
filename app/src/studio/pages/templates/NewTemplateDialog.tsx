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
import { upsertTemplateSidebarListRow } from "@/studio/lib/templates/template-sidebar-list";
import { studioApi } from "@/lib/studio/api";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";

type NewTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (templateId: string) => void;
  trigger?: ReactElement;
};

export function NewTemplateDialog({
  open,
  onOpenChange,
  onCreated,
  trigger,
}: NewTemplateDialogProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function createTemplate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { template } = await studioApi.createMessageTemplate({ name });
      upsertTemplateSidebarListRow(template);
      onOpenChange(false);
      setNewName("");
      onCreated(template.id);
    } catch {
      toast.error("Could not create template");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message template</DialogTitle>
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
            onClick={() => void createTemplate()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
