import type { Layout, ScaleDataStore, Template, Trigger } from "../../db/types";

export type ResolvedMessage = {
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  layoutId: string | null;
  templateVariables: Record<string, string>;
};

export function messageTemplateIdForOwner(ownerId: string): string {
  return `msgtpl_${ownerId}`;
}

export function findLayout(
  data: ScaleDataStore,
  layoutId: string | null | undefined,
): Layout | undefined {
  if (!layoutId) return undefined;
  return data.layouts.find((l) => l.id === layoutId);
}

export function findMessageTemplate(data: ScaleDataStore, id: string): Template | undefined {
  return data.templates.find((t) => t.id === id);
}

export function requireMessage(data: ScaleDataStore, messageTemplateId: string): ResolvedMessage {
  return (
    resolveMessage(data, messageTemplateId) ?? {
      subject: "",
      previewText: null,
      bodyMarkdown: "",
      layoutId: "tpl-minimal",
      templateVariables: {},
    }
  );
}

export function resolveMessage(
  data: ScaleDataStore,
  messageTemplateId: string,
): ResolvedMessage | null {
  const tpl = findMessageTemplate(data, messageTemplateId);
  if (!tpl) return null;
  return {
    subject: tpl.subject,
    previewText: tpl.previewText ?? null,
    bodyMarkdown: tpl.bodyMarkdown,
    layoutId: tpl.layoutId ?? null,
    templateVariables: tpl.templateVariables ?? {},
  };
}

export function triggerSource(row: Trigger): Trigger["source"] {
  return row.source;
}

export function getLayoutHtml(data: ScaleDataStore, layoutId: string | null | undefined): string | null {
  return findLayout(data, layoutId)?.htmlSource ?? null;
}

export function getLayoutSchema(data: ScaleDataStore, layoutId: string | null | undefined) {
  return findLayout(data, layoutId)?.variablesSchema ?? null;
}
