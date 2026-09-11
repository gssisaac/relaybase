"use client";

import { makeAutoObservable, runInAction } from "mobx";
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

/** Refresh callback from `useDesktop()` — re-reads credentials after an update. */
export type WorkerUpdateRefresh = () => Promise<unknown>;

export type WorkerUpdatePhase = "idle" | "checking" | "running" | "done" | "error";

export type WorkerUpdateStartResult =
  | { ok: true }
  | { ok: false; reason: "auth"; error: DesktopErrorHelp }
  | { ok: false; reason: "mismatch"; target: WorkerUpdateTarget };

/**
 * MobX store backing the Worker update runner.
 *
 * Lives once in `WorkerUpdateRunnerProvider` and survives route changes, so
 * the sidebar can subscribe to `phase` and show a global "Installing…"
 * indicator while the download/deploy runs in the background.
 */
export class WorkerUpdateRunnerStore {
  phase: WorkerUpdatePhase = "idle";
  logs: InstallLogEvent[] = [];
  error: DesktopErrorHelp | null = null;
  updatedWorkerUrl: string | null = null;
  updatedVersion: string | null = null;

  private running = false;
  private refresh: WorkerUpdateRefresh | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** Bind the desktop credentials refresher (called after a successful update). */
  bindRefresh(refresh: WorkerUpdateRefresh | null) {
    this.refresh = refresh;
  }

  /** True while an update is in flight (preview check or actual install). */
  get isInstalling(): boolean {
    return this.phase === "checking" || this.phase === "running";
  }

  async start(): Promise<WorkerUpdateStartResult> {
    if (this.running) return { ok: true };
    runInAction(() => {
      this.phase = "checking";
      this.error = null;
      this.updatedWorkerUrl = null;
      this.updatedVersion = null;
    });
    try {
      const target = await desktopPreviewWorkerUpdateTarget();
      if (!target.matches) {
        runInAction(() => {
          this.phase = "idle";
        });
        return { ok: false, reason: "mismatch", target };
      }
      void this.runUpdate();
      return { ok: true };
    } catch (err) {
      runInAction(() => {
        this.phase = "idle";
      });
      return {
        ok: false,
        reason: "auth",
        error: explainWorkerUpdateTargetError(err),
      };
    }
  }

  private async runUpdate() {
    this.running = true;
    runInAction(() => {
      this.phase = "running";
      this.logs = [];
      this.error = null;
    });
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenInstallLog((event) => {
        runInAction(() => {
          this.logs = [...this.logs, event];
        });
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
      if (this.refresh) await this.refresh();
      const version = result.workerVersion || connect?.version || null;
      runInAction(() => {
        this.updatedWorkerUrl = workerUrl;
        this.updatedVersion = version;
        this.phase = "done";
      });
      toast.success(version ? `Worker updated to v${version}` : "Worker updated");
    } catch (err) {
      if (isInstallCancelledError(err)) {
        runInAction(() => {
          this.phase = "idle";
        });
      } else {
        const help = explainDesktopError(err, "Worker update failed");
        runInAction(() => {
          this.error = help;
          this.phase = "error";
        });
        toast.error(help.title || "Worker update failed");
      }
    } finally {
      if (unlisten) unlisten();
      this.running = false;
    }
  }

  async cancel() {
    try {
      await desktopCancelAutoInstall();
    } catch {
      /* install promise rejects when cancel lands */
    }
  }

  reset() {
    if (this.running) return;
    runInAction(() => {
      this.phase = "idle";
      this.error = null;
      this.logs = [];
      this.updatedWorkerUrl = null;
      this.updatedVersion = null;
    });
  }
}
