"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type TemplateEditSaveState = "idle" | "saving" | "error";

type TemplateEditChromeCtx = {
  name: string;
  setName: (value: string) => void;
  subjectFallback: string;
  setSubjectFallback: (value: string) => void;
  saveState: TemplateEditSaveState;
  setSaveState: (state: TemplateEditSaveState) => void;
  requestSave: () => Promise<void>;
  registerSave: (fn: () => Promise<void>) => void;
};

const Ctx = createContext<TemplateEditChromeCtx | null>(null);

export function TemplateEditChromeProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState("");
  const [subjectFallback, setSubjectFallback] = useState("");
  const [saveState, setSaveState] = useState<TemplateEditSaveState>("idle");
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
        name,
        setName,
        subjectFallback,
        setSubjectFallback,
        saveState,
        setSaveState,
        requestSave,
        registerSave,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTemplateEditChrome() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useTemplateEditChrome must be used within TemplateEditChromeProvider");
  }
  return ctx;
}
