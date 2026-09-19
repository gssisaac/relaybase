import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { overviewKpiClassName } from "@/studio/pages/overview/OverviewKpiCard";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <span className={cn("block rounded-md bg-muted", className)} aria-hidden />;
}

export function StudioAnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Loading analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className={cn(overviewKpiClassName, "space-y-3 shadow-none")}>
            <Bone className="h-3 w-20" />
            <Bone className="h-8 w-14" />
            <Bone className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} size="sm">
            <CardHeader className="gap-0.5 pb-1">
              <Bone className="h-4 w-28" />
              <Bone className="h-3 w-40" />
            </CardHeader>
            <CardContent className="pt-0">
              <Bone className="h-28 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2 pb-2">
              <Bone className="h-4 w-36" />
              <Bone className="h-3 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, row) => (
                <Bone key={row} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
