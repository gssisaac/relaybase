"use client";

import { ChevronRight, Home, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDesktopChrome } from "@/lib/desktop/shell";
import {
  splitPinnedBreadcrumbs,
  withHostHomeCrumb,
  type BreadcrumbCrumb,
} from "@/lib/navigation/breadcrumbs";
import { cn } from "@/lib/utils";

/** Maximum trailing crumbs rendered inline; older ancestors collapse into "…". */
const MAX_VISIBLE = 2;

function HostHomeLink({
  href,
  label,
  current,
}: {
  href: string;
  label: string;
  current: boolean;
}) {
  if (current) {
    return (
      <span className="flex items-center gap-1 px-2" title={label}>
        <Home className="size-4 text-primary" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      nativeButton={false}
      render={<Link href={href} />}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground"
    >
      <Home className="size-4" />
    </Button>
  );
}

export type HeaderBreadcrumbProps = {
  /** Pinned host home at the start of the trail (railmark "Workspace" pattern). */
  home: BreadcrumbCrumb;
  crumbs: BreadcrumbCrumb[];
  className?: string;
};

/**
 * Compact breadcrumb for page headers (from railmark ContentHeader / HeaderBreadcrumb).
 * Host home stays pinned; middle ancestors can collapse into an overflow menu.
 */
export function HeaderBreadcrumb({ home, crumbs, className }: HeaderBreadcrumbProps) {
  const router = useRouter();
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const trail = useMemo(
    () => withHostHomeCrumb(crumbs, home),
    [crumbs, home],
  );
  const split = splitPinnedBreadcrumbs(trail, MAX_VISIBLE);

  if (!split) return null;

  const { pinned, hidden, trailing } = split;
  const lastPath = trailing[trailing.length - 1]?.path ?? pinned.path;
  const homeIsCurrent = lastPath === pinned.path;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex min-w-0 items-center gap-0.5 overflow-x-auto",
        noDragClassName,
        className,
      )}
      {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
    >
      <HostHomeLink href={pinned.path} label={pinned.label} current={homeIsCurrent} />
      {hidden.length > 0 ? (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="More ancestors"
                  className="h-7 shrink-0 px-1.5 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" side="bottom" sideOffset={4} className="min-w-44">
              {hidden.map((crumb) => (
                <DropdownMenuItem key={crumb.path} onClick={() => router.push(crumb.path)}>
                  <span className="truncate">{crumb.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
      {trailing.map((crumb) => {
        const isLast = crumb.path === lastPath;
        return (
          <span key={crumb.path} className="flex min-w-0 items-center gap-0.5">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" />
            {isLast ? (
              <span className="flex shrink-0 items-center gap-1 px-2">
                <span className="whitespace-nowrap text-sm font-medium text-primary">{crumb.label}</span>
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={crumb.path} />}
                className="h-7 shrink-0 px-2 text-muted-foreground hover:text-foreground"
              >
                <span className="whitespace-nowrap">{crumb.label}</span>
              </Button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
