"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type NewsletterContentSaveState = "idle" | "saving" | "error";

type NewsletterContentChromeCtx = {
  saveState: NewsletterContentSaveState;
  setSaveState: (state: NewsletterContentSaveState) => void;
  requestSave: () => Promise<void>;
  registerSave: (fn: () => Promise<void>) => void;
  settingsSheetOpen: boolean;
  setSettingsSheetOpen: (open: boolean) => void;
};

const Ctx = createContext<NewsletterContentChromeCtx | null>(null);

export function NewsletterContentChromeProvider({ children }: { children: ReactNode }) {
  const [saveState, setSaveState] = useState<NewsletterContentSaveState>("idle");
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const saveRef = useRef<(() => Promise<void>) | null>(null);

  const registerSave = useCallback((fn: () => Promise<void>) => {
    saveRef.current = fn;
  }, []);

  const requestSave = useCallback(async () => {
    if (saveRef.current) await saveRef.current();
  }, []);

  return (
    <Ctx.Provider
      value={{
        saveState,
        setSaveState,
        requestSave,
        registerSave,
        settingsSheetOpen,
        setSettingsSheetOpen,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useNewsletterContentChrome() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useNewsletterContentChrome must be used within NewsletterContentChromeProvider");
  }
  return ctx;
}
