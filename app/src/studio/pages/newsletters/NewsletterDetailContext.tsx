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

import {
  studioApi,
  type Newsletter,
  type NewsletterMember,
  type StudioLayout,
} from "@/lib/studio/api";

type DraftFields = {
  subject: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
  messageTemplateId: string | null;
};

type Ctx = {
  newsletterId: string;
  newsletter: Newsletter | null;
  templates: StudioLayout[];
  audienceMembers: NewsletterMember[];
  loading: boolean;
  notFound: boolean;
  setNewsletter: (newsletter: Newsletter) => void;
  refresh: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  refreshAudience: () => Promise<void>;
  syncDraft: (fields: DraftFields) => void;
  persistDraft: () => Promise<boolean>;
  getLastSavedDraft: () => DraftFields;
};

const NewsletterDetailCtx = createContext<Ctx | null>(null);

export function NewsletterDetailProvider({
  newsletterId,
  children,
}: {
  newsletterId: string;
  children: ReactNode;
}) {
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [templates, setTemplates] = useState<StudioLayout[]>([]);
  const [audienceMembers, setAudienceMembers] = useState<NewsletterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const draftRef = useRef<DraftFields>({
    subject: "",
    bodyMarkdown: "",
    templateId: "",
    templateVariables: {},
    messageTemplateId: null,
  });
  const lastSaved = useRef<DraftFields | null>(null);
  const persistInFlight = useRef<Promise<boolean> | null>(null);
  const newsletterRef = useRef<Newsletter | null>(null);
  newsletterRef.current = newsletter;

  const refreshAudience = useCallback(async () => {
    const { members } = await studioApi.listNewsletterAudience(newsletterId);
    setAudienceMembers(members);
  }, [newsletterId]);

  const refreshTemplates = useCallback(async () => {
    const t = await studioApi.listLayouts();
    setTemplates(t.layouts);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [b, t] = await Promise.all([
        studioApi.getNewsletter(newsletterId),
        studioApi.listLayouts(),
      ]);
      setNewsletter(b);
      setTemplates(t.layouts);
      setNotFound(false);
      const fields = {
        subject: b.subject,
        bodyMarkdown: b.bodyMarkdown,
        templateId: b.layoutId ?? "",
        templateVariables: b.templateVariables ?? {},
        messageTemplateId: b.messageTemplateId ?? null,
      };
      draftRef.current = fields;
      lastSaved.current = fields;
      try {
        await refreshAudience();
      } catch {
        setAudienceMembers([]);
      }
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setNewsletter(null);
    } finally {
      setLoading(false);
    }
  }, [newsletterId, refreshAudience]);

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
    const current = newsletterRef.current;
    if (!current || current.status !== "draft") return Promise.resolve(true);
    if (persistInFlight.current) return persistInFlight.current;

    const next = draftRef.current;
    const prev = lastSaved.current;
    if (
      prev &&
      prev.subject === next.subject &&
      prev.bodyMarkdown === next.bodyMarkdown &&
      prev.templateId === next.templateId &&
      prev.messageTemplateId === next.messageTemplateId &&
      templateVariablesEqual(prev.templateVariables, next.templateVariables)
    ) {
      return Promise.resolve(true);
    }

    const run = studioApi
      .updateNewsletter(newsletterId, {
        subject: next.subject,
        bodyMarkdown: next.bodyMarkdown,
        layoutId: next.templateId,
        templateVariables: next.templateVariables,
        messageTemplateId: next.messageTemplateId,
      })
      .then((updated) => {
        lastSaved.current = next;
        setNewsletter(updated);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        persistInFlight.current = null;
      });
    persistInFlight.current = run;
    return run;
  }, [newsletterId]);

  return (
    <NewsletterDetailCtx.Provider
      value={{
        newsletterId,
        newsletter,
        templates,
        audienceMembers,
        loading,
        notFound,
        setNewsletter,
        refresh,
        refreshTemplates,
        refreshAudience,
        syncDraft,
        persistDraft,
        getLastSavedDraft,
      }}
    >
      {children}
    </NewsletterDetailCtx.Provider>
  );
}

export function useNewsletterDetail() {
  const ctx = useContext(NewsletterDetailCtx);
  if (!ctx) throw new Error("useNewsletterDetail must be used inside NewsletterDetailProvider");
  return ctx;
}

function templateVariablesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "").trim() !== (b[key] ?? "").trim()) return false;
  }
  return true;
}
