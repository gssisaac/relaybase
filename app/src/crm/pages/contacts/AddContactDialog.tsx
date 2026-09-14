"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crmApi, CrmApiError, type Contact } from "@/lib/crm/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddContactDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contact: Contact) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEmail("");
    setName("");
    setTags("");
    setEmailError(null);
    setDuplicateId(null);
  }

  async function handleSave() {
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(null);
    setDuplicateId(null);
    setSaving(true);
    try {
      const contact = await crmApi.createContact({
        email: trimmed,
        name: name.trim() || undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toast.success("Contact added");
      onCreated(contact);
      onOpenChange(false);
      reset();
    } catch (err) {
      if (err instanceof CrmApiError && err.status === 409) {
        setDuplicateId((err.body?.contactId as string | undefined) ?? null);
      } else {
        toast.error(err instanceof Error ? err.message : "Could not add contact");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
                setDuplicateId(null);
              }}
              placeholder="alice@example.com"
            />
            {emailError ? <p className="text-xs text-destructive">{emailError}</p> : null}
            {duplicateId ? (
              <p className="text-xs text-destructive">
                Contact already registered.{" "}
                <a href={`/crm/contacts?id=${duplicateId}`} className="underline">
                  View existing contact
                </a>
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-tags">Tags (comma-separated)</Label>
            <Input
              id="contact-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="vip, beta"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !email.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
