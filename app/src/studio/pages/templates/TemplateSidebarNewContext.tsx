"use client";

import { createContext, useContext, type ReactNode } from "react";

type Ctx = {
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  onCreated: (templateId: string) => void;
};

const TemplateSidebarNewCtx = createContext<Ctx | null>(null);

export function TemplateSidebarNewProvider({
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

export function useTemplateSidebarNew() {
  return useContext(TemplateSidebarNewCtx);
}
