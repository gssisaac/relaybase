"use client";

import { reaction } from "mobx";
import * as React from "react";

import { useDesktop } from "@/lib/desktop/shell";
import {
  WorkerUpdateRunnerStore,
  type WorkerUpdatePhase,
  type WorkerUpdateRefresh,
  type WorkerUpdateStartResult,
} from "@/lib/desktop/worker-update/worker-update-runner-store";

export type {
  WorkerUpdatePhase,
  WorkerUpdateStartResult,
} from "@/lib/desktop/worker-update/worker-update-runner-store";

type WorkerUpdateRunnerValue = {
  phase: WorkerUpdatePhase;
  logs: ReturnType<WorkerUpdateRunnerStore["logs"]["slice"]>;
  error: WorkerUpdateRunnerStore["error"];
  updatedWorkerUrl: WorkerUpdateRunnerStore["updatedWorkerUrl"];
  updatedVersion: WorkerUpdateRunnerStore["updatedVersion"];
  /** True while an update is in flight (preview check or actual install). */
  isInstalling: boolean;
  /**
   * Silently confirms OAuth + the saved Worker still match, then runs the
   * update in the background (survives navigating away). Already-running
   * calls are coalesced.
   */
  start: () => Promise<WorkerUpdateStartResult>;
  /** Stop an in-flight update. The running promise then rejects. */
  cancel: () => Promise<void>;
  /** Clear a finished/errored run so the progress view can start fresh. */
  reset: () => void;
};

const WorkerUpdateRunnerContext =
  React.createContext<WorkerUpdateRunnerStore | null>(null);

export function WorkerUpdateRunnerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { refresh } = useDesktop();
  // Lazy initializer creates the store once and keeps it across re-renders
  // without touching a ref during render (avoids react-hooks/refs lint).
  const [store] = React.useState(() => new WorkerUpdateRunnerStore());

  // Keep the store bound to the latest desktop refresh fn (it never changes
  // in practice, but this avoids stale-closure lint churn).
  React.useEffect(() => {
    store.bindRefresh(refresh as WorkerUpdateRefresh | null);
  }, [store, refresh]);

  return (
    <WorkerUpdateRunnerContext.Provider value={store}>
      {children}
    </WorkerUpdateRunnerContext.Provider>
  );
}

/**
 * Subscribe to the global Worker update runner store. Re-renders on any
 * observable change (phase, logs, error, updatedVersion, …) via a MobX
 * reaction, so the sidebar banner and the progress page stay in sync
 * without prop drilling.
 */
export function useWorkerUpdateRunner(): WorkerUpdateRunnerValue {
  const store = React.useContext(WorkerUpdateRunnerContext);
  if (!store) {
    throw new Error(
      "useWorkerUpdateRunner must be used within WorkerUpdateRunnerProvider",
    );
  }
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        phase: store.phase,
        logsLen: store.logs.length,
        logsTail: store.logs.slice(-1)[0],
        error: store.error,
        updatedWorkerUrl: store.updatedWorkerUrl,
        updatedVersion: store.updatedVersion,
        isInstalling: store.isInstalling,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return {
    phase: store.phase,
    logs: store.logs,
    error: store.error,
    updatedWorkerUrl: store.updatedWorkerUrl,
    updatedVersion: store.updatedVersion,
    isInstalling: store.isInstalling,
    start: store.start,
    cancel: store.cancel,
    reset: store.reset,
  };
}

/** Raw store accessor for components that want to read `phase`/`isInstalling`
 *  without subscribing to the full value shape. */
export function useWorkerUpdateRunnerStore(): WorkerUpdateRunnerStore {
  const store = React.useContext(WorkerUpdateRunnerContext);
  if (!store) {
    throw new Error(
      "useWorkerUpdateRunnerStore must be used within WorkerUpdateRunnerProvider",
    );
  }
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        phase: store.phase,
        isInstalling: store.isInstalling,
        error: store.error,
        updatedVersion: store.updatedVersion,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return store;
}
