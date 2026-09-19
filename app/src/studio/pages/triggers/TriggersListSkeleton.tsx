import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <span className={cn("block rounded-md bg-muted", className)} aria-hidden />;
}

export function TriggersListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading triggers">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Bone key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <Bone className="h-9 w-full max-w-md" />
      {Array.from({ length: 6 }).map((_, index) => (
        <Bone key={index} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}
