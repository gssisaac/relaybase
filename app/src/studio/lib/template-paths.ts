"use client";

export function messageTemplatePreviewHref(id: string): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  return `/studio/templates?${params.toString()}`;
}

export function messageTemplateEditHref(id: string): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  return `/studio/templates/edit?${params.toString()}`;
}

/** Preview URL for a message template (sidebar + email preview). */
export function messageTemplateDetailHref(id: string): string {
  return messageTemplatePreviewHref(id);
}

export function messageTemplateFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { templateId: string } | null {
  const templateId = searchParams.get("id")?.trim() ?? "";
  if (!templateId) return null;
  return { templateId };
}
