"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  desktopCancelAutoInstall,
  desktopPreviewWorkerUpdateTarget,
  desktopRegisterWorkerWithConsole,
  desktopUpdateInstalledWorker,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  explainWorkerUpdateTargetError,
  isInstallCancelledError,
  listenInstallLog,
  saveUserConnection,
  type DesktopErrorHelp,
  type InstallLogEvent,
  type WorkerUpdateTarget,
} from "@/lib/desktop/bridge";
import { useDesktop } from "@/lib/desktop/shell";

export type WorkerUpdatePhase = "idle" | "checking" | "running" | "done" | "error";

export type WorkerUpdateStartResult =
  | { ok: true }
  | { ok: false; reason: "auth"; error: DesktopErrorHelp }
  | { ok: false; reason: "mismatch"; target: WorkerUpdateTarget };

type WorkerUpdateRunnerValue = {
  phase: WorkerUpdatePhase;
  logs: InstallLogEvent[];
  error: DesktopErrorHelp | null;
  updatedWorkerUrl: string | null;
  updatedVersion: string | null;
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
  createContext<WorkerUpdateRunnerValue | null>(null);

export function WorkerUpdateRunnerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { refresh } = useDesktop();
  const [phase, setPhase] = useState<WorkerUpdatePhase>("idle");
  const [logs, setLogs] = useState<InstallLogEvent[]>([]);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [updatedWorkerUrl, setUpdatedWorkerUrl] = useState<string | null>(null);
  const [updatedVersion, setUpdatedVersion] = useState<string | null>(null);
  const runningRef = useRef(false);

  const runUpdate = useCallback(async () => {
    runningRef.current = true;
    setPhase("running");
    setLogs([]);
    setError(null);
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenInstallLog((event) => {
        setLogs((prev) => [...prev, event]);
      });
      const result = await desktopUpdateInstalledWorker();
      let connect: Awaited<ReturnType<typeof desktopVerifyWorkerConnection>> | null =
        null;
      try {
        connect = await desktopVerifyWorkerConnection(result.workerUrl);
      } catch {
        connect = null;
      }
      const workerUrl = connect?.workerUrl || result.workerUrl;
      await saveUserConnection({
        workerUrl,
        accountId: connect?.accountId,
        workerScriptName:
          connect?.workerScriptName || result.workerScriptName || "relaybase-api",
        workerVersion: result.workerVersion || connect?.version,
      });
      void desktopRegisterWorkerWithConsole(workerUrl).catch(() => {
        /* best-effort */
      });
      await refresh();
      const version = result.workerVersion || connect?.version || null;
      setUpdatedWorkerUrl(workerUrl);
      setUpdatedVersion(version);
      setPhase("done");
      toast.success(version ? `Worker updated to v${version}` : "Worker updated");
    } catch (err) {
      if (isInstallCancelledError(err)) {
        setPhase("idle");
      } else {
        const help = explainDesktopError(err, "Worker update failed");
        setError(help);
        setPhase("error");
        toast.error(help.title || "Worker update failed");
      }
    } finally {
      if (unlisten) unlisten();
      runningRef.current = false;
    }
  }, [refresh]);

  const start = useCallback(async (): Promise<WorkerUpdateStartResult> => {
    if (runningRef.current) return { ok: true };
    setPhase("checking");
    setError(null);
    setUpdatedWorkerUrl(null);
    setUpdatedVersion(null);
    try {
      const target = await desktopPreviewWorkerUpdateTarget();
      if (!target.matches) {
        setPhase("idle");
        return { ok: false, reason: "mismatch", target };
      }
      void runUpdate();
      return { ok: true };
    } catch (err) {
      setPhase("idle");
      return { ok: false, reason: "auth", error: explainWorkerUpdateTargetError(err) };
    }
  }, [runUpdate]);

  const cancel = useCallback(async () => {
    try {
      await desktopCancelAutoInstall();
    } catch {
      /* install promise rejects when cancel lands */
    }
  }, []);

  const reset = useCallback(() => {
    if (runningRef.current) return;
    setPhase("idle");
    setError(null);
    setLogs([]);
    setUpdatedWorkerUrl(null);
    setUpdatedVersion(null);
  }, []);

  const value = useMemo(
    () => ({
      phase,
      logs,
      error,
      updatedWorkerUrl,
      updatedVersion,
      start,
      cancel,
      reset,
    }),
    [phase, logs, error, updatedWorkerUrl, updatedVersion, start, cancel, reset],
  );

  return (
    <WorkerUpdateRunnerContext.Provider value={value}>
      {children}
    </WorkerUpdateRunnerContext.Provider>
  );
}

export function useWorkerUpdateRunner(): WorkerUpdateRunnerValue {
  const ctx = useContext(WorkerUpdateRunnerContext);
  if (!ctx) {
    throw new Error(
      "useWorkerUpdateRunner must be used within WorkerUpdateRunnerProvider",
    );
  }
  return ctx;
}
