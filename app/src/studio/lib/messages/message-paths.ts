"use client";

/** Saved message copies — list, preview, edit. */
export function messagesRootHref(): string {
  return "/studio/messages";
}

export function messagePreviewHref(id: string): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  return `/studio/messages?${params.toString()}`;
}

export function messageEditHref(id: string): string {
  const params = new URLSearchParams();
  params.set("id", id.trim());
  return `/studio/messages/edit?${params.toString()}`;
}

export function messageDetailHref(id: string): string {
  return messagePreviewHref(id);
}

export function messageFromSearch(searchParams: {
  get: (name: string) => string | null;
}): { messageId: string } | null {
  const messageId = searchParams.get("id")?.trim() ?? "";
  if (!messageId) return null;
  return { messageId };
}
