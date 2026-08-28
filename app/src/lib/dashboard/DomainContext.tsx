"use client";

import * as React from "react";
import { reaction } from "mobx";

import { useAppSession } from "@/lib/desktop/app-session";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import {
  DomainStore,
  type DomainAddJob,
  type DomainOnboardingStep,
  type DomainOnboardingSummary,
  type DomainProgressCard,
  type DomainSummary,
  type MxConflictRecord,
  type OnboardingFailureCode,
  type OnboardingOverallStatus,
  type OnboardingStepStatus,
} from "@/lib/dashboard/domain-store";

export type {
  DomainAddJob,
  DomainOnboardingStep,
  DomainOnboardingSummary,
  DomainProgressCard,
  DomainSummary,
  MxConflictRecord,
  OnboardingFailureCode,
  OnboardingOverallStatus,
  OnboardingStepStatus,
};

export {
  DEFAULT_ADDRESS_DISPLAY_NAMES,
  DEFAULT_ADDRESS_LOCAL_PARTS,
  DomainStore,
  defaultInboundEnabledForLocalPart,
  suggestedDisplayNameForLocalPart,
} from "@/lib/dashboard/domain-store";

const DomainStoreContext = React.createContext<DomainStore | null>(null);

export function DomainProvider({ children }: { children: React.ReactNode }) {
  const userId = useProductId();
  const session = useAppSession();
  const storeRef = React.useRef<DomainStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new DomainStore();
  }
  const store = storeRef.current;

  const ownerAwaitingConsole =
    session.phase.kind === "ownerReady" && !session.hasConsoleAccess;

  React.useEffect(() => {
    if (ownerAwaitingConsole) {
      store.stop();
      return;
    }
    void store.start();
    return () => {
      store.stop();
    };
  }, [store, ownerAwaitingConsole]);

  React.useEffect(() => {
    if (ownerAwaitingConsole) return;
    void store.refresh();
  }, [store, userId, ownerAwaitingConsole, session.hasConsoleAccess]);

  return (
    <DomainStoreContext.Provider value={store}>
      {children}
    </DomainStoreContext.Provider>
  );
}

export function useDomainStore(): DomainStore {
  const store = React.useContext(DomainStoreContext);
  if (!store) throw new Error("DomainProvider required");
  return store;
}

/**
 * MobX DomainStore with a React subscription so route changes keep the same
 * instance while components still re-render on observable updates.
 */
export function useDomain(): DomainStore {
  const store = useDomainStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        domains: store.domains.map((d) => [
          d.domain,
          d.addressCount,
          d.audienceCount,
          d.broadcastCount,
          d.sentCount,
          d.r2Provisioned,
          d.r2BucketName,
          d.r2WorkerReady,
          d.onboarding?.status,
          d.onboarding?.currentStep,
          d.onboarding?.currentStepLabel,
          d.onboarding?.lastError,
          d.onboarding?.steps?.map((s) => [s.id, s.status, s.error]),
        ]),
        loading: store.loading,
        error: store.error,
        jobs: store.addJobs.map((j) => [
          j.id,
          j.domain,
          j.kind,
          j.phase,
          j.message,
          j.error,
          j.seedDefaults,
          j.addressesAdded.length,
        ]),
        isWorking: store.isWorking,
        hasProgress: store.hasProgress,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return store;
}
