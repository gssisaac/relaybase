"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { campaignDetailHref } from "@/crm/lib/paths";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CampaignOverviewView() {
  const { campaign, campaignId, templates, contactCount, contactCountHasMore, loading } =
    useCampaignDetail();

  if (loading && !campaign) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!campaign) return null;

  const template = templates.find((t) => t.id === campaign.templateId);
  const recipients =
    contactCount == null
      ? "All contacts"
      : `All contacts · ${contactCount}${contactCountHasMore ? "+" : ""}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Overview</CardTitle>
          <CardDescription>
            Summary of this campaign. Edit content anytime; send from Publish.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="outline" className="mt-1 capitalize">
              {campaign.status}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recipients</p>
            <p className="mt-1 font-medium tabular-nums">{recipients}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Template</p>
            <p className="mt-1">{template?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Updated</p>
            <p className="mt-1">{formatWhen(campaign.updatedAt)}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="mt-1 font-medium">
              {campaign.subject?.trim() || "Untitled draft"}
            </p>
          </div>
          {campaign.scheduledAt ? (
            <div>
              <p className="text-xs text-muted-foreground">Scheduled</p>
              <p className="mt-1">{formatWhen(campaign.scheduledAt)}</p>
            </div>
          ) : null}
          {campaign.sentAt ? (
            <div>
              <p className="text-xs text-muted-foreground">Sent</p>
              <p className="mt-1">{formatWhen(campaign.sentAt)}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={campaignDetailHref(campaignId, "content")} />}
        >
          Edit content
        </Button>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={campaignDetailHref(campaignId, "publish")} />}
        >
          Publish
        </Button>
      </div>
    </div>
  );
}
