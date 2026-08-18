"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { useEmailPaths } from "@/email/paths";
import { SenderIconStore } from "@/email/sender-icon-store";

const SenderIconStoreContext = createContext<SenderIconStore | null>(null);

export function SenderIconProvider({ children }: { children: ReactNode }) {
  const { apiBase } = useEmailPaths();
  const [store] = useState(() => new SenderIconStore(apiBase));

  return (
    <SenderIconStoreContext.Provider value={store}>
      {children}
    </SenderIconStoreContext.Provider>
  );
}

export function useSenderIconStore(): SenderIconStore {
  const store = useContext(SenderIconStoreContext);
  if (!store) {
    throw new Error("useSenderIconStore requires SenderIconProvider");
  }
  return store;
}
