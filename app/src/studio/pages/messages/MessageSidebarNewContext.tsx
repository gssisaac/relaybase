"use client";

import { createContext, useContext, type ReactNode } from "react";

type Ctx = {
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  onCreated: (messageId: string) => void;
};

const TemplateSidebarNewCtx = createContext<Ctx | null>(null);

export function MessageSidebarNewProvider({
  addOpen,
  setAddOpen,
  onCreated,
  children,
}: Ctx & { children: ReactNode }) {
  return (
    <TemplateSidebarNewCtx.Provider value={{ addOpen, setAddOpen, onCreated }}>
      {children}
    </TemplateSidebarNewCtx.Provider>
  );
}

export function useMessageSidebarNew() {
  return useContext(TemplateSidebarNewCtx);
}
