"use client";

import { makeAutoObservable, runInAction } from "mobx";

import {
  desktopDeployWorker,
  desktopOnDeployLog,
  desktopOnDeployStatus,
  type DeployLogLine,
  type DeployOpts,
  type DeployResult,
  type DeployStatus,
} from "@/lib/desktop/bridge";

export type DeployPhase =
  | "idle"
  | "extract"
  | "npm-install"
  | "provision"
  | "deploy"
  | "secret"
  | "migrate"
  | "record"
  | "verify"
  | "done"
  | "failed";

const MAX_LINES = 500;

/**
 * MobX store for the in-app Wrangler deploy. Subscribes to the streaming
 * `worker-deploy:log` / `worker-deploy:status` Tauri events and exposes the
 * current step, busy flag, and the last N log lines to the Settings dialog.
 */
export class WorkerDeployStore {
  phase: DeployPhase = "idle";
  busy = false;
  error: string | null = null;
  result: DeployResult | null = null;
  lines: DeployLogLine[] = [];
  statusMessage = "";

  private unlistenLog: (() => void) | null = null;
  private unlistenStatus: (() => void) | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get currentStep(): DeployPhase {
    return this.phase;
  }

  private async ensureListeners() {
    if (!this.unlistenLog) {
      try {
        this.unlistenLog = await desktopOnDeployLog((line) => {
          runInAction(() => {
            this.lines.push(line);
            if (this.lines.length > MAX_LINES) {
              this.lines.splice(0, this.lines.length - MAX_LINES);
            }
          });
        });
      } catch {
        /* non-desktop or events unavailable */
      }
    }
    if (!this.unlistenStatus) {
      try {
        this.unlistenStatus = await desktopOnDeployStatus((status) => {
          runInAction(() => {
            this.phase = status.step as DeployPhase;
            this.statusMessage = status.message;
            if (status.state === "failed") {
              this.busy = false;
              this.error = status.message;
            }
          });
        });
      } catch {
        /* non-desktop or events unavailable */
      }
    }
  }

  async deploy(opts: DeployOpts): Promise<DeployResult> {
    await this.ensureListeners();
    runInAction(() => {
      this.busy = true;
      this.error = null;
      this.result = null;
      this.lines = [];
      this.phase = "idle";
      this.statusMessage = "Starting…";
    });
    try {
      const result = await desktopDeployWorker(opts);
      runInAction(() => {
        this.result = result;
        this.phase = "done";
        this.busy = false;
        this.statusMessage = "Deploy complete";
      });
      return result;
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : "Deploy failed. See the log.";
        this.phase = "failed";
        this.busy = false;
      });
      throw err;
    }
  }

  clear() {
    runInAction(() => {
      this.lines = [];
      this.error = null;
      this.phase = "idle";
      this.statusMessage = "";
    });
  }

  dispose() {
    this.unlistenLog?.();
    this.unlistenStatus?.();
    this.unlistenLog = null;
    this.unlistenStatus = null;
  }
}

let singleton: WorkerDeployStore | null = null;

export function getWorkerDeployStore(): WorkerDeployStore {
  if (!singleton) singleton = new WorkerDeployStore();
  return singleton;
}

export type { DeployOpts, DeployResult, DeployStatus, DeployLogLine };
