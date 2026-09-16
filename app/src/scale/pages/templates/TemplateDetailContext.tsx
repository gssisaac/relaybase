"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { upsertTemplateSidebarListRow } from "@/scale/lib/templates/template-sidebar-list";
import { scaleApi, type MessageTemplate, type ScaleLayout } from "@/lib/scale/api";

export type TemplateDraftFields = {
  name: string;
  subject: string;
  previewText: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
};

type DraftFields = TemplateDraftFields;

type Ctx = {
  messageTemplateId: string;
  template: MessageTemplate | null;
  layouts: ScaleLayout[];
  loading: boolean;
  notFound: boolean;
  setTemplate: (template: MessageTemplate) => void;
  refresh: () => Promise<void>;
  refreshLayouts: () => Promise<void>;
  syncDraft: (fields: DraftFields) => void;
  persistDraft: () => Promise<boolean>;
  getDraft: () => DraftFields;
  getLastSavedDraft: () => DraftFields;
};

const TemplateDetailCtx = createContext<Ctx | null>(null);

function templateVariablesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "").trim() !== (b[key] ?? "").trim()) return false;
  }
  return true;
}

export function TemplateDetailProvider({
  messageTemplateId,
  children,
}: {
  messageTemplateId: string;
  children: ReactNode;
}) {
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [layouts, setLayouts] = useState<ScaleLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const draftRef = useRef<DraftFields>({
    name: "",
    subject: "",
    previewText: "",
    bodyMarkdown: "",
    templateId: "",
    templateVariables: {},
  });
  const lastSaved = useRef<DraftFields | null>(null);
  const persistInFlight = useRef<Promise<boolean> | null>(null);
  const templateRef = useRef<MessageTemplate | null>(null);
  templateRef.current = template;

  const refreshLayouts = useCallback(async () => {
    const t = await scaleApi.listLayouts();
    setLayouts(t.layouts);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [detail, layoutList] = await Promise.all([
        scaleApi.getMessageTemplate(messageTemplateId),
        scaleApi.listLayouts(),
      ]);
      setTemplate(detail.template);
      upsertTemplateSidebarListRow(detail.template);
      setLayouts(layoutList.layouts);
      setNotFound(false);
      const fields: DraftFields = {
        name: detail.template.name,
        subject: detail.template.subject,
        previewText: detail.template.previewText ?? "",
        bodyMarkdown: detail.template.bodyMarkdown,
        templateId: detail.template.layoutId ?? layoutList.layouts[0]?.id ?? "",
        templateVariables: detail.template.templateVariables ?? {},
      };
      draftRef.current = fields;
      lastSaved.current = fields;
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setTemplate(null);
    } finally {
      setLoading(false);
    }
  }, [messageTemplateId]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setTemplate(null);
    lastSaved.current = null;
    void refresh();
  }, [messageTemplateId, refresh]);

  const syncDraft = useCallback((fields: DraftFields) => {
    draftRef.current = fields;
  }, []);

  const getDraft = useCallback((): DraftFields => ({ ...draftRef.current }), []);

  const getLastSavedDraft = useCallback((): DraftFields => {
    return lastSaved.current ?? draftRef.current;
  }, []);

  const persistDraft = useCallback((): Promise<boolean> => {
    if (!templateRef.current) return Promise.resolve(false);
    if (persistInFlight.current) return persistInFlight.current;

    const next = draftRef.current;
    const prev = lastSaved.current;
    if (
      prev &&
      prev.name === next.name &&
      prev.subject === next.subject &&
      prev.previewText === next.previewText &&
      prev.bodyMarkdown === next.bodyMarkdown &&
      prev.templateId === next.templateId &&
      templateVariablesEqual(prev.templateVariables, next.templateVariables)
    ) {
      return Promise.resolve(true);
    }

    const run = scaleApi
      .updateMessageTemplate(messageTemplateId, {
        name: next.name.trim(),
        subject: next.subject,
        previewText: next.previewText.trim() || null,
        bodyMarkdown: next.bodyMarkdown,
        layoutId: next.templateId || null,
        templateVariables: next.templateVariables,
      })
      .then(({ template: updated }) => {
        lastSaved.current = next;
        setTemplate(updated);
        upsertTemplateSidebarListRow(updated);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        persistInFlight.current = null;
      });
    persistInFlight.current = run;
    return run;
  }, [messageTemplateId]);

  return (
    <TemplateDetailCtx.Provider
      value={{
        messageTemplateId,
        template,
        layouts,
        loading,
        notFound,
        setTemplate,
        refresh,
        refreshLayouts,
        syncDraft,
        persistDraft,
        getDraft,
        getLastSavedDraft,
      }}
    >
      {children}
    </TemplateDetailCtx.Provider>
  );
}

export function useTemplateDetail() {
  const ctx = useContext(TemplateDetailCtx);
  if (!ctx) throw new Error("useTemplateDetail must be used inside TemplateDetailProvider");
  return ctx;
}
