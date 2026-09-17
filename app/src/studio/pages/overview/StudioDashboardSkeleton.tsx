import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <span className={cn("block rounded-md bg-muted", className)} aria-hidden />;
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader className="space-y-2 pb-2">
        <Bone className="h-4 w-36" />
        <Bone className="h-3 w-2/3 max-w-sm" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <Bone key={index} className={cn("h-10 w-full", index === 0 && "h-16")} />
        ))}
      </CardContent>
    </Card>
  );
}

export function StudioDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      <Card>
        <CardHeader className="space-y-2 pb-2">
          <Bone className="h-4 w-40" />
          <Bone className="h-3 w-56" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Bone key={index} className="aspect-[640/452] w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
