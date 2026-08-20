"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { ResolvedEmailCommand } from "@/email/commands/email-command-store";
import type { MailListItem } from "@/email/components/mailbox/types";

export type EmailCommandRuntimeScope = {
  title: string;
  targetId?: string;
  targetKind?: MailListItem["kind"];
  /** Selection-filtered available commands only. */
  commands: ResolvedEmailCommand[];
};

function scopeSignature(scope: EmailCommandRuntimeScope | null): string {
  if (!scope) return "";
  const commands = scope.commands
    .map((command) => `${command.id}:${command.label}`)
    .join(",");
  return `${scope.title}\0${scope.targetId ?? ""}\0${scope.targetKind ?? ""}\0${commands}`;
}

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
  const [scope, setScopeState] = useState<EmailCommandRuntimeScope | null>(
    null,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const signatureRef = useRef<string>("");

  // Skip setState entirely when selection/command ids are unchanged so adapters
  // that rebuild command arrays every render cannot loop via context updates.
  const setScope = useCallback((next: EmailCommandRuntimeScope | null) => {
    const nextSignature = scopeSignature(next);
    if (signatureRef.current === nextSignature) return;
    signatureRef.current = nextSignature;
    setScopeState(next);
  }, []);

  const value = useMemo(
    () => ({
      scope,
      setScope,
      paletteOpen,
      setPaletteOpen,
    }),
    [paletteOpen, scope, setScope],
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
