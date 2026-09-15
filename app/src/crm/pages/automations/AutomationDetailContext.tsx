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

import { crmApi, type Automation, type CrmTemplate } from "@/lib/crm/api";

type DraftFields = {
  subject: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
  previewText: string;
};

type Ctx = {
  automationId: string;
  automation: Automation | null;
  templates: CrmTemplate[];
  loading: boolean;
  notFound: boolean;
  setAutomation: (automation: Automation) => void;
  refresh: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  syncDraft: (fields: DraftFields) => void;
  persistDraft: () => Promise<boolean>;
  getLastSavedDraft: () => DraftFields;
};

const AutomationDetailCtx = createContext<Ctx | null>(null);

function templateVariablesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  }
  return true;
}

export function AutomationDetailProvider({
  automationId,
  children,
}: {
  automationId: string;
  children: ReactNode;
}) {
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [templates, setTemplates] = useState<CrmTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const draftRef = useRef<DraftFields>({
    subject: "",
    bodyMarkdown: "",
    templateId: "",
    templateVariables: {},
    previewText: "",
  });
  const lastSaved = useRef<DraftFields | null>(null);
  const persistInFlight = useRef<Promise<boolean> | null>(null);
  const automationRef = useRef<Automation | null>(null);
  automationRef.current = automation;

  const refreshTemplates = useCallback(async () => {
    const t = await crmApi.listTemplates();
    setTemplates(t.templates);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [row, t] = await Promise.all([
        crmApi.getAutomation(automationId),
        crmApi.listTemplates(),
      ]);
      setAutomation(row);
      setTemplates(t.templates);
      setNotFound(false);
      const fields: DraftFields = {
        subject: row.subject,
        bodyMarkdown: row.bodyMarkdown,
        templateId: row.templateId ?? "",
        templateVariables: row.templateVariables ?? {},
        previewText: row.previewText ?? "",
      };
      draftRef.current = fields;
      lastSaved.current = fields;
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setAutomation(null);
    } finally {
      setLoading(false);
    }
  }, [automationId]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    lastSaved.current = null;
    void refresh();
  }, [refresh]);

  const syncDraft = useCallback((fields: DraftFields) => {
    draftRef.current = fields;
  }, []);

  const getLastSavedDraft = useCallback((): DraftFields => {
    return lastSaved.current ?? draftRef.current;
  }, []);

  const persistDraft = useCallback((): Promise<boolean> => {
    if (!automationRef.current) return Promise.resolve(false);
    if (persistInFlight.current) return persistInFlight.current;

    const next = draftRef.current;
    const prev = lastSaved.current;
    if (
      prev &&
      prev.subject === next.subject &&
      prev.bodyMarkdown === next.bodyMarkdown &&
      prev.templateId === next.templateId &&
      prev.previewText === next.previewText &&
      templateVariablesEqual(prev.templateVariables, next.templateVariables)
    ) {
      return Promise.resolve(true);
    }

    const run = crmApi
      .updateAutomation(automationId, {
        subject: next.subject,
        bodyMarkdown: next.bodyMarkdown,
        templateId: next.templateId || null,
        templateVariables: next.templateVariables,
        previewText: next.previewText || null,
      })
      .then((updated) => {
        lastSaved.current = next;
        setAutomation(updated);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        persistInFlight.current = null;
      });
    persistInFlight.current = run;
    return run;
  }, [automationId]);

  return (
    <AutomationDetailCtx.Provider
      value={{
        automationId,
        automation,
        templates,
        loading,
        notFound,
        setAutomation,
        refresh,
        refreshTemplates,
        syncDraft,
        persistDraft,
        getLastSavedDraft,
      }}
    >
      {children}
    </AutomationDetailCtx.Provider>
  );
}

export function useAutomationDetail() {
  const ctx = useContext(AutomationDetailCtx);
  if (!ctx) {
    throw new Error("useAutomationDetail must be used inside AutomationDetailProvider");
  }
  return ctx;
}
