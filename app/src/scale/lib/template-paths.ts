"use client";

export function messageTemplateDetailHref(id: string): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  return `/scale/templates?${params.toString()}`;
}

export function messageTemplateFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { templateId: string } | null {
  const templateId = searchParams.get("id")?.trim() ?? "";
  if (!templateId) return null;
  return { templateId };
}
