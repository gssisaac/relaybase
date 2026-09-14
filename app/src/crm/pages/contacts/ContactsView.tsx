"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { crmApi, type Contact } from "@/lib/crm/api";
import { AddContactDialog } from "./AddContactDialog";
import { ContactDetailSheet } from "./ContactDetailSheet";

const STATUSES = ["lead", "customer", "subscriber", "churned"] as const;

export function ContactsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("id");
  const followupOnly = searchParams.get("view") === "followup";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [followupCount, setFollowupCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      if (followupOnly) {
        const data = await crmApi.listFollowup();
        setContacts(data.contacts);
        setFollowupCount(data.contacts.length);
      } else {
        const [list, followup] = await Promise.all([
          crmApi.listContacts({ search: search || undefined, status: status || undefined }),
          crmApi.listFollowup(),
        ]);
        setContacts(list.contacts);
        setFollowupCount(followup.contacts.length);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [search, status, followupOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  function openContact(id: string) {
    router.push(`/crm/contacts?id=${id}`);
  }

  function closeSheet() {
    router.push(followupOnly ? "/crm/contacts?view=followup" : "/crm/contacts");
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Contacts</h1>
          {followupCount > 0 ? (
            <button
              className="text-sm text-amber-600 underline dark:text-amber-400"
              onClick={() => router.push("/crm/contacts?view=followup")}
            >
              Awaiting reply ({followupCount})
            </button>
          ) : null}
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {followupOnly ? (
        <div className="flex items-center justify-between rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
          <span>Showing contacts awaiting a reply</span>
          <button className="underline" onClick={() => router.push("/crm/contacts")}>
            Clear filter
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search email or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={status === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setStatus(null)}
            >
              All
            </Badge>
            {STATUSES.map((s) => (
              <Badge
                key={s}
                variant={status === s ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setStatus(s)}
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <p>Could not load contacts.</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No matching contacts
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer"
                onClick={() => openContact(contact.id)}
              >
                <TableCell>{contact.name || "—"}</TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{contact.status}</TableCell>
                <TableCell className="space-x-1">
                  {contact.source === "audience_migration" ? (
                    <Badge variant="outline">Migrated</Badge>
                  ) : null}
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>{new Date(contact.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AddContactDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => void load()}
      />
      <ContactDetailSheet
        contactId={activeId}
        onClose={closeSheet}
        onDeleted={() => void load()}
      />
    </div>
  );
}
