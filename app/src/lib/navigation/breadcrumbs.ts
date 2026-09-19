export type BreadcrumbCrumb = {
  label: string;
  /** Route href (Next.js path). */
  path: string;
};

export type SplitPinnedBreadcrumbs = {
  pinned: BreadcrumbCrumb;
  hidden: BreadcrumbCrumb[];
  trailing: BreadcrumbCrumb[];
};

/** Prepend the host home crumb when the trail does not already include it. */
export function withHostHomeCrumb(
  crumbs: BreadcrumbCrumb[],
  home: BreadcrumbCrumb,
): BreadcrumbCrumb[] {
  if (crumbs[0]?.path === home.path) return crumbs;
  return [home, ...crumbs];
}

/**
 * Keep the first crumb (host home) visible and collapse only middle ancestors.
 * `maxTrailing` is how many crumbs after home render inline.
 */
export function splitPinnedBreadcrumbs(
  crumbs: BreadcrumbCrumb[],
  maxTrailing: number,
): SplitPinnedBreadcrumbs | null {
  if (crumbs.length === 0) return null;
  const [pinned, ...rest] = crumbs;
  if (rest.length <= maxTrailing) {
    return { pinned, hidden: [], trailing: rest };
  }
  const hiddenCount = rest.length - maxTrailing;
  return {
    pinned,
    hidden: rest.slice(0, hiddenCount),
    trailing: rest.slice(hiddenCount),
  };
}
