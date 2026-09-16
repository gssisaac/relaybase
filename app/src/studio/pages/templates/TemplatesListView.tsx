"use client";

import { LayoutTemplate, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
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
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { messageTemplateDetailHref } from "@/studio/lib/template-paths";
import { useStudioPaths } from "@/studio/lib/paths";
import { studioApi, type MessageTemplate } from "@/lib/studio/api";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";

export function TemplatesListView() {
  const router = useRouter();
  const { layouts: layoutsPath } = useStudioPaths();
  const [rows, setRows] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const { templates } = await studioApi.listMessageTemplates();
      setRows(templates);
    } catch {
      toast.error("Could not load templates");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function createTemplate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { template } = await studioApi.createMessageTemplate({ name });
      setAddOpen(false);
      setNewName("");
      await load(true);
      router.push(messageTemplateDetailHref(template.id));
    } catch {
      toast.error("Could not create template");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={layoutsPath} />}>
              <LayoutTemplate className="size-4" />
              Layouts
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger
                render={
                  <Button size="sm">
                    <Plus className="size-4" />
                    New template
                  </Button>
                }
              />
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
                    placeholder="Welcome email"
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
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing || loading}
              onClick={() => void load(true)}
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Message content linked from newsletters and triggers. HTML frames live under Layouts.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("flex min-h-0 flex-1 flex-col gap-3")}>
        <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search templates…" />

        <EmailListContainer>
          <EmailTableHeader>
            <span>Name</span>
            <span className="hidden sm:block">Subject</span>
            <span className="hidden sm:block">Updated</span>
          </EmailTableHeader>
          {loading ? (
            <div className="min-h-[200px]" />
          ) : filtered.length === 0 ? (
            <EmptyListState
              title={rows.length === 0 ? "No templates yet" : "No matching templates"}
              description={
                rows.length === 0
                  ? "Create a template, then link it when composing a newsletter or trigger."
                  : `Nothing matches "${search}".`
              }
              action={
                rows.length === 0 ? (
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    New template
                  </Button>
                ) : undefined
              }
            />
          ) : (
            filtered.map((row) => (
              <EmailTableRow
                key={row.id}
                href={messageTemplateDetailHref(row.id)}
                primary={row.name}
                subject={row.subject || "No subject"}
                date={new Date(row.updatedAt).toLocaleDateString()}
              />
            ))
          )}
        </EmailListContainer>
        </div>
      </div>
    </div>
  );
}
