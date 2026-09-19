"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type EmailButtonSettingsContextValue = {
  openBlockId: string | null;
  setOpenBlockId: (blockId: string | null) => void;
};

const EmailButtonSettingsContext = createContext<EmailButtonSettingsContextValue | null>(
  null,
);

export function EmailButtonSettingsProvider({ children }: { children: ReactNode }) {
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const value = useMemo(
    () => ({
      openBlockId,
      setOpenBlockId,
    }),
    [openBlockId],
  );
  return (
    <EmailButtonSettingsContext.Provider value={value}>
      {children}
    </EmailButtonSettingsContext.Provider>
  );
}

export function useEmailButtonSettings() {
  const ctx = useContext(EmailButtonSettingsContext);
  if (!ctx) {
    throw new Error("useEmailButtonSettings must be used within EmailButtonSettingsProvider");
  }
  return ctx;
}
