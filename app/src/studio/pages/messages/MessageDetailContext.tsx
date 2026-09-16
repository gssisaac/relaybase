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

import { upsertMessageSidebarListRow } from "@/studio/lib/messages/message-sidebar-list";
import {
  studioApi,
  StudioApiError,
  type StudioMessage,
  type StudioLayout,
} from "@/lib/studio/api";

export type MessageDraftFields = {
  name: string;
  subject: string;
  previewText: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
};

type DraftFields = MessageDraftFields;

type Ctx = {
  messageId: string;
  message: StudioMessage | null;
  layouts: StudioLayout[];
  loading: boolean;
  notFound: boolean;
  setMessage: (message: StudioMessage) => void;
  refresh: () => Promise<void>;
  refreshLayouts: () => Promise<void>;
  syncDraft: (fields: DraftFields) => void;
  persistDraft: () => Promise<boolean>;
  getDraft: () => DraftFields;
  getLastSavedDraft: () => DraftFields;
};

const MessageDetailCtx = createContext<Ctx | null>(null);

function templateVariablesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "").trim() !== (b[key] ?? "").trim()) return false;
  }
  return true;
}

export function MessageDetailProvider({
  messageId,
  children,
}: {
  messageId: string;
  children: ReactNode;
}) {
  const [message, setMessage] = useState<StudioMessage | null>(null);
  const [layouts, setLayouts] = useState<StudioLayout[]>([]);
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
  const messageRef = useRef<StudioMessage | null>(null);
  messageRef.current = message;

  const refreshLayouts = useCallback(async () => {
    const t = await studioApi.listLayouts();
    setLayouts(t.layouts);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [detail, layoutList] = await Promise.all([
        studioApi.getMessage(messageId),
        studioApi.listLayouts(),
      ]);
      if (!detail.message?.id) {
        throw new StudioApiError(502, "Invalid message response", null);
      }
      setMessage(detail.message);
      upsertMessageSidebarListRow(detail.message);
      setLayouts(layoutList.layouts);
      setNotFound(false);
      const fields: DraftFields = {
        name: detail.message.name,
        subject: detail.message.subject,
        previewText: detail.message.previewText ?? "",
        bodyMarkdown: detail.message.bodyMarkdown,
        templateId: detail.message.layoutId ?? layoutList.layouts[0]?.id ?? "",
        templateVariables: detail.message.templateVariables ?? {},
      };
      draftRef.current = fields;
      lastSaved.current = fields;
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setMessage(null);
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setMessage(null);
    lastSaved.current = null;
    void refresh();
  }, [messageId, refresh]);

  const syncDraft = useCallback((fields: DraftFields) => {
    draftRef.current = fields;
  }, []);

  const getDraft = useCallback((): DraftFields => ({ ...draftRef.current }), []);

  const getLastSavedDraft = useCallback((): DraftFields => {
    return lastSaved.current ?? draftRef.current;
  }, []);

  const persistDraft = useCallback((): Promise<boolean> => {
    if (!messageRef.current) return Promise.resolve(false);
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

    const run = studioApi
      .updateMessage(messageId, {
        name: next.name.trim(),
        subject: next.subject,
        previewText: next.previewText.trim() || null,
        bodyMarkdown: next.bodyMarkdown,
        layoutId: next.templateId || null,
        templateVariables: next.templateVariables,
      })
      .then(({ message: updated }) => {
        lastSaved.current = next;
        setMessage(updated);
        upsertMessageSidebarListRow(updated);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        persistInFlight.current = null;
      });
    persistInFlight.current = run;
    return run;
  }, [messageId]);

  return (
    <MessageDetailCtx.Provider
      value={{
        messageId,
        message,
        layouts,
        loading,
        notFound,
        setMessage,
        refresh,
        refreshLayouts,
        syncDraft,
        persistDraft,
        getDraft,
        getLastSavedDraft,
      }}
    >
      {children}
    </MessageDetailCtx.Provider>
  );
}

export function useMessageDetail() {
  const ctx = useContext(MessageDetailCtx);
  if (!ctx) throw new Error("useMessageDetail must be used inside MessageDetailProvider");
  return ctx;
}
