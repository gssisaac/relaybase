"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { ResolvedEmailCommand } from "@/email/commands/email-command-store";
import type { MailListItem } from "@/email/components/types";

export type EmailCommandRuntimeScope = {
  title: string;
  targetId?: string;
  targetKind?: MailListItem["kind"];
  /** Selection-filtered available commands only. */
  commands: ResolvedEmailCommand[];
};

type EmailCommandRuntimeContextValue = {
  scope: EmailCommandRuntimeScope | null;
  setScope: (scope: EmailCommandRuntimeScope | null) => void;
  /** App-layer: Cmd+K palette open — mail-layer shortcuts must no-op. */
  paletteOpen: boolean;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
};

const EmailCommandRuntimeContext =
  createContext<EmailCommandRuntimeContextValue | null>(null);

export function EmailCommandRuntimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [scope, setScope] = useState<EmailCommandRuntimeScope | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const value = useMemo(
    () => ({
      scope,
      setScope,
      paletteOpen,
      setPaletteOpen,
    }),
    [paletteOpen, scope],
  );

  return (
    <EmailCommandRuntimeContext.Provider value={value}>
      {children}
    </EmailCommandRuntimeContext.Provider>
  );
}

export function useEmailCommandRuntime() {
  const context = useContext(EmailCommandRuntimeContext);
  if (!context) {
    throw new Error(
      "useEmailCommandRuntime must be used within EmailCommandRuntimeProvider",
    );
  }
  return context;
}
