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

import { triggersHubStore } from "@/studio/stores/triggers-hub";
import { studioApi, type Trigger, type StudioLayout } from "@/studio/api";

type DraftFields = {
  subject: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
  previewText: string;
  messageId: string | null;
};

type Ctx = {
  triggerId: string;
  trigger: Trigger | null;
  templates: StudioLayout[];
  loading: boolean;
  notFound: boolean;
  setTrigger: (trigger: Trigger) => void;
  refresh: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  syncDraft: (fields: DraftFields) => void;
  persistDraft: () => Promise<boolean>;
  getLastSavedDraft: () => DraftFields;
};

const TriggerDetailCtx = createContext<Ctx | null>(null);

function templateVariablesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  }
  return true;
}

export function TriggerDetailProvider({
  triggerId,
  children,
}: {
  triggerId: string;
  children: ReactNode;
}) {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [templates, setTemplates] = useState<StudioLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const draftRef = useRef<DraftFields>({
    subject: "",
    bodyMarkdown: "",
    templateId: "",
    templateVariables: {},
    previewText: "",
    messageId: null,
  });
  const lastSaved = useRef<DraftFields | null>(null);
  const persistInFlight = useRef<Promise<boolean> | null>(null);
  const triggerRef = useRef<Trigger | null>(null);
  triggerRef.current = trigger;

  const refreshTemplates = useCallback(async () => {
    const t = await studioApi.listLayouts();
    setTemplates(t.layouts);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [row, t] = await Promise.all([
        studioApi.getTrigger(triggerId),
        studioApi.listLayouts(),
      ]);
      setTrigger(row);
      triggersHubStore.upsertTrigger(row);
      setTemplates(t.layouts);
      setNotFound(false);
      const fields: DraftFields = {
        subject: row.subject,
        bodyMarkdown: row.bodyMarkdown,
        templateId: row.layoutId ?? "",
        templateVariables: row.templateVariables ?? {},
        previewText: row.previewText ?? "",
        messageId: row.messageId ?? null,
      };
      draftRef.current = fields;
      lastSaved.current = fields;
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setTrigger(null);
    } finally {
      setLoading(false);
    }
  }, [triggerId]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setTrigger(null);
    lastSaved.current = null;
    void refresh();
  }, [triggerId, refresh]);

  const syncDraft = useCallback((fields: DraftFields) => {
    draftRef.current = fields;
  }, []);

  const getLastSavedDraft = useCallback((): DraftFields => {
    return lastSaved.current ?? draftRef.current;
  }, []);

  const persistDraft = useCallback((): Promise<boolean> => {
    if (!triggerRef.current) return Promise.resolve(false);
    if (persistInFlight.current) return persistInFlight.current;

    const next = draftRef.current;
    const prev = lastSaved.current;
    if (
      prev &&
      prev.subject === next.subject &&
      prev.bodyMarkdown === next.bodyMarkdown &&
      prev.templateId === next.templateId &&
      prev.previewText === next.previewText &&
      prev.messageId === next.messageId &&
      templateVariablesEqual(prev.templateVariables, next.templateVariables)
    ) {
      return Promise.resolve(true);
    }

    const run = studioApi
      .updateTrigger(triggerId, {
        subject: next.subject,
        bodyMarkdown: next.bodyMarkdown,
        layoutId: next.templateId || null,
        templateVariables: next.templateVariables,
        previewText: next.previewText || null,
      })
      .then((updated) => {
        lastSaved.current = next;
        setTrigger(updated);
        triggersHubStore.upsertTrigger(updated);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        persistInFlight.current = null;
      });
    persistInFlight.current = run;
    return run;
  }, [triggerId]);

  return (
    <TriggerDetailCtx.Provider
      value={{
        triggerId,
        trigger,
        templates,
        loading,
        notFound,
        setTrigger: (next) => {
          setTrigger(next);
          triggersHubStore.upsertTrigger(next);
        },
        refresh,
        refreshTemplates,
        syncDraft,
        persistDraft,
        getLastSavedDraft,
      }}
    >
      {children}
    </TriggerDetailCtx.Provider>
  );
}

export function useTriggerDetail() {
  const ctx = useContext(TriggerDetailCtx);
  if (!ctx) {
    throw new Error("useTriggerDetail must be used inside TriggerDetailProvider");
  }
  return ctx;
}
