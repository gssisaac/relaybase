"use client";

import { useState, type ReactElement } from "react";
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
import { useVerifiedAccounts } from "@/lib/scale/VerifiedAccountsContext";
import { VerificationPendingDialog } from "@/scale/components/verified-accounts/VerificationPendingDialog";

export function AddVerifiedAccountDialog({
  groupId,
  trigger,
  onAdded,
}: {
  groupId: string;
  trigger: ReactElement;
  onAdded?: () => void;
}) {
  const store = useVerifiedAccounts();
  const [open, setOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) return;
    setSubmitting(true);
    try {
      const result = await store.addVerifiedAccount({
        groupId,
        email: trimmed,
        name: name.trim() || undefined,
      });
      setOpen(false);
      setEmail("");
      setName("");
      onAdded?.();
      if (result.verification === "verified") {
        toast.success(`${trimmed} is verified`);
      } else {
        setPendingEmail(trimmed);
        setPendingOpen(true);
        toast.message("Verification email sent", {
          description: `Check ${trimmed} and click the link.`,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={trigger} />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add verified account</DialogTitle>
            <DialogDescription>
              Registers the address with Cloudflare Email Routing and adds it to this
              group. Verified recipients do not consume daily send quota.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Display name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting || !email.trim().includes("@")}
              onClick={() => void submit()}
            >
              {submitting ? "Adding…" : "Add & send verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <VerificationPendingDialog
        email={pendingEmail}
        open={pendingOpen}
        onOpenChange={setPendingOpen}
        onVerified={() => {
          onAdded?.();
          setPendingEmail(null);
        }}
      />
    </>
  );
}
