import { overviewKpiClassName } from "@/studio/pages/overview/OverviewKpiCard";
import { studioGalleryGridClassName } from "@/studio/lib/gallery/studio-gallery-grid";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <span className={cn("block rounded-md bg-muted", className)} aria-hidden />;
}

export function NewsletterGalleryCardSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-card animate-pulse">
      <Bone className="aspect-[640/452] w-full shrink-0 rounded-none" />
      <div className="space-y-2 border-t px-3 py-2.5">
        <Bone className="h-4 w-3/4" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-4/5" />
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t px-3 py-2">
        <Bone className="h-5 w-16 rounded-full" />
        <Bone className="h-3 w-10" />
      </div>
    </div>
  );
}

export function NewsletterGallerySkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      className={cn(studioGalleryGridClassName, "animate-pulse")}
      aria-busy="true"
      aria-label="Loading newsletters"
    >
      {Array.from({ length: count }).map((_, index) => (
        <li key={index} className="flex min-h-0 min-w-0">
          <NewsletterGalleryCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

export function NewsletterListKpiSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-3 animate-pulse" aria-busy="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className={cn(overviewKpiClassName, "space-y-3 shadow-none")}>
          <div className="flex items-center gap-2">
            <Bone className="size-4 shrink-0 rounded" />
            <Bone className="h-3 w-20" />
          </div>
          <Bone className="h-8 w-12" />
          <Bone className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function NewsletterListToolbarSkeleton() {
  return (
    <div className="flex animate-pulse flex-wrap items-center gap-2" aria-hidden>
      <Bone className="h-9 min-w-[12rem] flex-1 rounded-md" />
      <Bone className="h-9 w-24 rounded-md" />
    </div>
  );
}

export function NewsletterListBodySkeleton() {
  return (
    <div className="space-y-4">
      <NewsletterListKpiSkeleton />
      <NewsletterListToolbarSkeleton />
      <NewsletterGallerySkeleton />
    </div>
  );
}

function CardBlockSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <Bone className="h-4 w-2/5" />
      {Array.from({ length: lines }).map((_, index) => (
        <Bone key={index} className={cn("h-3", index === lines - 1 ? "w-full" : "w-4/5")} />
      ))}
    </div>
  );
}

export function NewsletterInProgressBodySkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading send progress">
      <div className="flex flex-wrap gap-2">
        <Bone className="h-6 w-24 rounded-full" />
        <Bone className="h-6 w-28 rounded-full" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <CardBlockSkeleton lines={3} />
        <CardBlockSkeleton lines={3} />
      </div>
      <div className="rounded-xl border bg-card">
        <div className="space-y-2 border-b p-4">
          <Bone className="h-4 w-24" />
          <Bone className="h-3 w-3/4 max-w-md" />
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-2/5" />
              <Bone className="h-3 w-3/5" />
            </div>
            <Bone className="h-5 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewsletterSentOverviewBodySkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading sent statistics">
      <Bone className="h-3 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border bg-card p-4 space-y-3">
            <Bone className="h-3 w-20" />
            <Bone className="h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <Bone className="h-4 w-32" />
        <Bone className="h-3 w-2/3 max-w-lg" />
        <div className="flex h-28 items-end gap-2 pt-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <span
              key={index}
              className="block min-h-[2rem] flex-1 rounded-sm bg-muted"
              style={{ height: `${40 + (index % 4) * 12}%` }}
              aria-hidden
            />
          ))}
        </div>
      </div>
      <div className="rounded-xl border bg-card">
        <div className="space-y-2 border-b p-4">
          <Bone className="h-4 w-36" />
          <Bone className="h-3 w-2/3 max-w-md" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-1/3" />
              <Bone className="h-3 w-1/2" />
            </div>
            <Bone className="h-5 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewsletterDetailShellSkeleton() {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden animate-pulse"
      aria-busy="true"
      aria-label="Loading newsletter"
    >
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Bone className="size-8 shrink-0 rounded-md" />
        <Bone className="h-4 w-40 max-w-[40%]" />
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <Bone key={index} className="h-7 w-20 rounded-md" />
          ))}
        </div>
        <Bone className="ml-auto h-5 w-14 shrink-0 rounded-full" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Bone className="h-9 w-32 rounded-md" />
          <Bone className="h-9 w-28 rounded-md" />
        </div>
        <Bone className="min-h-[min(480px,55vh)] flex-1 rounded-lg" />
      </div>
    </div>
  );
}

/** Neutral shell while `useSearchParams` / pathname resolve (list, section, or detail). */
export function NewslettersRouteFallbackSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex animate-pulse flex-wrap items-center gap-3 px-4 py-3" aria-hidden>
        <Bone className="h-6 w-28" />
        <Bone className="h-7 w-56 max-w-full rounded-md" />
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4 animate-pulse" aria-busy="true">
          <Bone className="h-24 w-full rounded-xl" />
          <Bone className="min-h-[240px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
