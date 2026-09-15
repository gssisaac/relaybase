"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCOUNT_DEFAULT_COMPLIANCE_VALUE,
  findComplianceIdentityById,
} from "@/scale/lib/compliance-identity";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { scaleApi, ScaleApiError, type ScaleComplianceIdentity } from "@/lib/scale/api";

type EditorMode = "account-default" | "broadcast";

export function ComplianceIdentityEditor({
  mode,
  selectedIdentityId,
  onSelectedIdentityIdChange,
  accountDefaultIdentityId,
  onIdentitySaved,
  compact,
  description,
}: {
  mode: EditorMode;
  /** For broadcast mode, null/ACCOUNT_DEFAULT = use account default. */
  selectedIdentityId: string | null;
  onSelectedIdentityIdChange: (id: string | null) => void | Promise<void>;
  accountDefaultIdentityId: string | null;
  onIdentitySaved?: (identity: ScaleComplianceIdentity) => void;
  compact?: boolean;
  description?: string;
}) {
  const [identities, setIdentities] = useState<ScaleComplianceIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [postalAddress, setPostalAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scaleApi.listComplianceIdentities();
      setIdentities(res.identities);
    } catch {
      toast.error("Could not load compliance senders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pickerValue = useMemo(() => {
    if (mode === "broadcast") {
      return selectedIdentityId ?? ACCOUNT_DEFAULT_COMPLIANCE_VALUE;
    }
    return selectedIdentityId ?? accountDefaultIdentityId ?? "";
  }, [mode, selectedIdentityId, accountDefaultIdentityId]);

  const editingId = useMemo(() => {
    if (mode === "broadcast") {
      if (selectedIdentityId) return selectedIdentityId;
      return accountDefaultIdentityId;
    }
    return selectedIdentityId ?? accountDefaultIdentityId;
  }, [mode, selectedIdentityId, accountDefaultIdentityId]);

  const editingIdentity = findComplianceIdentityById(identities, editingId);

  const pickerItems = useMemo(() => {
    const rows = identities.map((row) => ({ value: row.id, label: row.name }));
    if (mode === "broadcast") {
      const defaultName = identities.find((i) => i.id === accountDefaultIdentityId)?.name;
      rows.unshift({
        value: ACCOUNT_DEFAULT_COMPLIANCE_VALUE,
        label: defaultName ? `Account default · ${defaultName}` : "Account default",
      });
    }
    rows.push({ value: "__create__", label: "Add new sender…" });
    return rows;
  }, [identities, mode, accountDefaultIdentityId]);

  useEffect(() => {
    setName(editingIdentity?.name ?? "");
    setOrganizationName(editingIdentity?.organizationName ?? "");
    setPostalAddress(editingIdentity?.postalAddress ?? "");
    setContactEmail(editingIdentity?.contactEmail ?? "");
  }, [editingIdentity?.id, editingIdentity?.updatedAt]);

  async function handlePickerChange(value: string | null) {
    if (!value) return;
    if (value === "__create__") {
      setAddOpen(true);
      return;
    }
    if (mode === "broadcast") {
      const next = value === ACCOUNT_DEFAULT_COMPLIANCE_VALUE ? null : value;
      await onSelectedIdentityIdChange(next);
      return;
    }
    await onSelectedIdentityIdChange(value);
  }

  async function saveIdentity() {
    if (!editingId) {
      toast.error("Select or create a compliance sender first");
      return;
    }
    setSaving(true);
    try {
      const { identity } = await scaleApi.updateComplianceIdentity(editingId, {
        name: name.trim() || editingIdentity?.name || "Sender",
        organizationName: organizationName.trim() || null,
        postalAddress: postalAddress.trim() || null,
        contactEmail: contactEmail.trim() || null,
      });
      setIdentities((prev) => prev.map((row) => (row.id === identity.id ? identity : row)));
      onIdentitySaved?.(identity);
      toast.success("Compliance sender saved");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      toast.error(err instanceof ScaleApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function createIdentity() {
    setCreating(true);
    try {
      const { identity } = await scaleApi.createComplianceIdentity({
        name: newName.trim() || organizationName.trim() || "New sender",
        organizationName: organizationName.trim() || null,
        postalAddress: postalAddress.trim() || null,
        contactEmail: contactEmail.trim() || null,
        setAsDefault: mode === "account-default",
      });
      setIdentities((prev) => [...prev, identity]);
      setAddOpen(false);
      setNewName("");
      await onSelectedIdentityIdChange(mode === "broadcast" ? identity.id : identity.id);
      if (mode === "account-default") {
        await scaleApi.updateAccountLink({ defaultComplianceIdentityId: identity.id });
      }
      onIdentitySaved?.(identity);
      toast.success("Compliance sender created");
    } catch (err) {
      toast.error(err instanceof ScaleApiError ? err.message : "Could not create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={compact ? "space-y-3" : "grid gap-3"}>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="compliance-identity-picker">
          {mode === "broadcast" ? "Footer sender for this broadcast" : "Default compliance sender"}
        </Label>
        <Select
          items={pickerItems}
          value={pickerValue || null}
          onValueChange={(v) => void handlePickerChange(v)}
        >
          <SelectTrigger id="compliance-identity-picker" className="w-full">
            <SelectValue placeholder={loading ? "Loading…" : "Select sender"} />
          </SelectTrigger>
          <SelectContent>
            {mode === "broadcast" ? (
              <SelectItem value={ACCOUNT_DEFAULT_COMPLIANCE_VALUE}>
                Account default
                {accountDefaultIdentityId
                  ? ` · ${identities.find((i) => i.id === accountDefaultIdentityId)?.name ?? "…"}`
                  : ""}
              </SelectItem>
            ) : null}
            {identities.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.name}
              </SelectItem>
            ))}
            <SelectItem value="__create__">
              <span className="flex items-center gap-1.5">
                <Plus className="size-3.5" />
                Add new sender…
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {editingIdentity ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="compliance-label">Label</Label>
            <Input
              id="compliance-label"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={examplePlaceholder("Acme US marketing")}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compliance-org">Organization name</Label>
            <Input
              id="compliance-org"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder={examplePlaceholder("Acme Inc.")}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compliance-address">Physical postal address</Label>
            <Textarea
              id="compliance-address"
              value={postalAddress}
              onChange={(e) => setPostalAddress(e.target.value)}
              placeholder={examplePlaceholder("123 Main St, City, ST 12345, Country")}
              rows={compact ? 2 : 3}
            />
            <p className="text-xs text-muted-foreground">
              Required for CAN-SPAM commercial email in the US. Shown in the template footer at send
              time.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compliance-email">Compliance contact email</Label>
            <Input
              id="compliance-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="compliance@yourdomain.com"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void saveIdentity()} disabled={saving}>
              {saving ? "Saving…" : "Save sender"}
            </Button>
            {savedFlash ? <span className="text-xs text-emerald-600">✓ Saved</span> : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Changes apply everywhere this sender is selected — including other broadcasts and
            Settings.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Add a compliance sender to populate the built-in footer (organization, address, contact).
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add compliance sender</DialogTitle>
            <DialogDescription>
              Reusable footer details. You can select this sender on any broadcast.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-compliance-name">Label</Label>
              <Input
                id="new-compliance-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={examplePlaceholder("EU entity")}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-compliance-org">Organization name</Label>
              <Input
                id="new-compliance-org"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder={examplePlaceholder("Acme Inc.")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void createIdentity()} disabled={creating}>
              {creating ? "Creating…" : "Create & select"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
