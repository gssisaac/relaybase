"use client";

export function layoutDetailHref(id: string): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  return `/studio/settings/layouts?${params.toString()}`;
}

export function layoutFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { layoutId: string } | null {
  const layoutId = searchParams.get("id")?.trim() ?? "";
  if (!layoutId) return null;
  return { layoutId };
}
