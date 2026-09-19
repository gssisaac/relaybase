"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { getFeedbackDraftStore } from "@/lib/feedback/feedback-draft-store";

type FeedbackDialogContextValue = {
  openFeedback: () => void;
};

const FeedbackDialogContext = createContext<FeedbackDialogContextValue | null>(
  null,
);

export function useFeedbackDialog() {
  const ctx = useContext(FeedbackDialogContext);
  if (!ctx) {
    throw new Error("useFeedbackDialog requires FeedbackDialogProvider");
  }
  return ctx;
}

export function useOptionalFeedbackDialog() {
  return useContext(FeedbackDialogContext);
}

export function FeedbackDialogProvider({ children }: { children: ReactNode }) {
  const store = getFeedbackDraftStore();

  const openFeedback = useCallback(() => {
    store.openDialog();
  }, [store]);

  const value = useMemo(() => ({ openFeedback }), [openFeedback]);

  return (
    <FeedbackDialogContext.Provider value={value}>
      {children}
      <FeedbackDialog />
    </FeedbackDialogContext.Provider>
  );
}
