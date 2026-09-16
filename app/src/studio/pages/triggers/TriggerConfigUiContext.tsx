"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readTriggerConfigInspectorOpen,
  writeTriggerConfigInspectorOpen,
} from "@/studio/lib/triggers/trigger-config-inspector";

type Ctx = {
  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  openInspector: () => void;
  closeInspector: () => void;
};

const TriggerConfigUiCtx = createContext<Ctx | null>(null);

export function TriggerConfigUiProvider({ children }: { children: ReactNode }) {
  const [inspectorOpen, setInspectorOpenState] = useState(() => readTriggerConfigInspectorOpen());

  const setInspectorOpen = useCallback((open: boolean) => {
    setInspectorOpenState(open);
    writeTriggerConfigInspectorOpen(open);
  }, []);

  const openInspector = useCallback(() => setInspectorOpen(true), [setInspectorOpen]);
  const closeInspector = useCallback(() => setInspectorOpen(false), [setInspectorOpen]);

  const value = useMemo(
    () => ({
      inspectorOpen,
      setInspectorOpen,
      openInspector,
      closeInspector,
    }),
    [inspectorOpen, setInspectorOpen, openInspector, closeInspector],
  );

  return <TriggerConfigUiCtx.Provider value={value}>{children}</TriggerConfigUiCtx.Provider>;
}

export function useTriggerConfigUi(): Ctx | null {
  return useContext(TriggerConfigUiCtx);
}

/** Config tab only — throws if provider missing. */
export function useTriggerConfigUiRequired(): Ctx {
  const ctx = useContext(TriggerConfigUiCtx);
  if (!ctx) {
    throw new Error("useTriggerConfigUiRequired must be used within TriggerConfigUiProvider");
  }
  return ctx;
}
