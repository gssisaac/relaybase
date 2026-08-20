"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useEmailPaths } from "@/email/lib/paths";
import {
  clearAudienceGroupDetailCache,
  useAudienceGroupDetail,
} from "@/dashboard/components/AudienceGroupDetailContext";
import { EmailAlerts } from "@/email/components/mailbox/EmailShared";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  readResponseJson,
} from "@/lib/desktop/api-base";
import {
  DetailView,
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";
import { audienceContactDisplayName } from "@/lib/audience-display";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AudienceGroupContactsView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { groupId, detail, loading, refresh } = useAudienceGroupDetail();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const contacts = detail?.contacts ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .filter(
        (c) =>
          !q ||
          c.email.toLowerCase().includes(q) ||
          (c.name?.toLowerCase().includes(q) ?? false),
      )
      .map((c) => ({
        key: c.id,
        primary: audienceContactDisplayName(c.email, c.name),
        subject: c.email,
        contact: c,
      }));
  }, [contacts, search]);

  const selected = contacts.find((c) => c.id === selectedId);

  async function addContact() {
    setSaving(true);
    setError(null);
    try {
      const res = await desktopAwareFetch(
        `${apiBase}/audience-groups/${encodeURIComponent(groupId)}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: contactEmail,
            name: contactName || undefined,
          }),
        },
      );
      const data = await readResponseJson<{
        contact: { email: string };
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to add contact");
      setContactEmail("");
      setContactName("");
      setAddOpen(false);
      setMessage(`Added ${data.contact.email}`);
      clearAudienceGroupDetailCache(productId, groupId);
      await refresh(true);
    } catch (e) {
      setError(friendlyDesktopFetchError(e, "Failed to add contact"));
    } finally {
      setSaving(false);
    }
  }

  async function removeContact(contactId: string) {
    setError(null);
    try {
      const res = await desktopAwareFetch(
        `${apiBase}/audience-groups/${encodeURIComponent(groupId)}/contacts?contactId=${encodeURIComponent(contactId)}`,
        { method: "DELETE" },
      );
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to remove contact");
      setSelectedId(null);
      clearAudienceGroupDetailCache(productId, groupId);
      await refresh(true);
    } catch (e) {
      setError(friendlyDesktopFetchError(e, "Failed to remove contact"));
    }
  }

  if (selected) {
    return (
      <EmailListContainer>
        <DetailView
          title={audienceContactDisplayName(selected.email, selected.name)}
          onBack={() => setSelectedId(null)}
          actions={
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeContact(selected.id)}
            >
              Remove
            </Button>
          }
        >
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="font-mono">{selected.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Name</dt>
              <dd>
                {audienceContactDisplayName(selected.email, selected.name)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Source</dt>
              <dd>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {selected.source}
                </Badge>
              </dd>
            </div>
          </dl>
        </DetailView>
      </EmailListContainer>
    );
  }

  return (
    <div className="space-y-4">
      <EmailAlerts
        error={error}
        message={message}
        onDismissError={() => setError(null)}
        onDismissMessage={() => setMessage(null)}
      />

      <EmailListContainer>
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search contacts…"
          trailing={
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger render={<Button size="sm" />}>
                <Plus className="size-4" />
                Add contact
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add contact</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name (optional)</Label>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={saving || !contactEmail.trim()}
                    onClick={addContact}
                  >
                    {saving ? "Adding…" : "Add"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />
        {rows.length > 0 ? (
          <>
            <EmailTableHeader>
              <span>Name</span>
              <span className="hidden sm:block">Email</span>
              <span />
              <span className="text-right">Source</span>
            </EmailTableHeader>
            <div>
              {rows.map((row) => (
                <EmailTableRow
                  key={row.key}
                  onClick={() => setSelectedId(row.key)}
                  primary={row.primary}
                  subject={row.subject}
                  date=""
                  status={
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {row.contact.source}
                    </Badge>
                  }
                />
              ))}
            </div>
          </>
        ) : !loading ? (
          <EmptyListState
            title="No contacts yet"
            description="Add contacts manually, or sync a data source from Settings."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                Add contact
              </Button>
            }
          />
        ) : (
          <div className="min-h-[200px]" />
        )}
      </EmailListContainer>
    </div>
  );
}
