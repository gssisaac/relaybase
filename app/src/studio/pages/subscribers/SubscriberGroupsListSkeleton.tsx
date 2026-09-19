import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { overviewKpiClassName } from "@/studio/pages/overview/OverviewKpiCard";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <span className={cn("block rounded-md bg-muted", className)} aria-hidden />;
}

export function SubscriberGroupsListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading subscriber groups">
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className={cn(overviewKpiClassName, "space-y-3 shadow-none")}>
            <Bone className="h-3 w-20" />
            <Bone className="h-8 w-14" />
            <Bone className="h-3 w-32" />
          </div>
        ))}
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Bone className="h-4 w-36" />
          <Bone className="h-3 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Bone className="h-8 max-w-xs w-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Bone key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
