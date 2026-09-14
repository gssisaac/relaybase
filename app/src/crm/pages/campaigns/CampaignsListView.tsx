"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { crmApi, type Campaign } from "@/lib/crm/api";

const STATUS_VARIANT: Record<Campaign["status"], "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "secondary",
  sent: "default",
  failed: "destructive",
};

export function CampaignsListView() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    crmApi
      .listCampaigns()
      .then((data) => setCampaigns(data.campaigns))
      .catch(() => toast.error("Could not load campaigns"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const campaign = await crmApi.createCampaign();
      router.push(`/crm/campaigns?id=${campaign.id}`);
    } catch {
      toast.error("Could not create campaign");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Campaigns</h1>
        <Button onClick={() => void handleCreate()} disabled={creating}>
          <Plus className="size-3.5" />
          New campaign
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No campaigns yet
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead>Clicked</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => router.push(`/crm/campaigns?id=${c.id}`)}
              >
                <TableCell>{c.subject || "(untitled)"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                </TableCell>
                <TableCell>{c.stats.sent}</TableCell>
                <TableCell>{c.stats.opened}</TableCell>
                <TableCell>{c.stats.clicked}</TableCell>
                <TableCell>{new Date(c.updatedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
