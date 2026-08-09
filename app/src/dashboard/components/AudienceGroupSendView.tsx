"use client";

import { Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAudienceGroupDetail } from "@/dashboard/components/AudienceGroupDetailContext";
import { useDashboardPaths } from "@/dashboard/paths";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AudienceGroupSendView() {
  const { groupId, detail } = useAudienceGroupDetail();
  const { broadcasts } = useDashboardPaths();
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Send a broadcast</CardTitle>
        <CardDescription>
          Start a broadcast targeting this group
          {detail?.group.name ? (
            <>
              {" "}
              (
              <span className="font-medium text-foreground">
                {detail.group.name}
              </span>
              ). You can add more audiences in the next step.
            </>
          ) : (
            ". You can add more audiences in the next step."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          size="sm"
          onClick={() =>
            router.push(
              `${broadcasts}?new=1&groupId=${encodeURIComponent(groupId)}`,
            )
          }
        >
          <Megaphone className="size-4" />
          New broadcast
        </Button>
      </CardContent>
    </Card>
  );
}
