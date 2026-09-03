"use client";

import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const STARTUP_DELAY_MS = 8_000;
const PERIODIC_CHECK_MS = 24 * 60 * 60 * 1000;

export type AppUpdaterPhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready";

type AppUpdaterContextValue = {
  phase: AppUpdaterPhase;
  /** Currently installed desktop app version (from Tauri). */
  currentVersion: string | null;
  /** Remote version when an update is available / downloading / ready. */
  version: string | null;
  progressLabel: string | null;
  statusMessage: string | null;
  lastError: string | null;
  /** Manual check (console Settings). Works whenever running in Tauri. */
  checkNow: () => Promise<void>;
  /** Download + install a previously discovered update. */
  installNow: () => Promise<void>;
  restartToUpdate: () => Promise<void>;
};

const AppUpdaterContext = createContext<AppUpdaterContextValue | null>(null);

function releaseNotesPreview(body: string | undefined): string | null {
  if (!body?.trim()) return null;
  const firstLine = body
    .trim()
    .split("\n")
    .find((line) => line.trim() && !line.startsWith("#"));
  if (!firstLine) return null;
  const trimmed = firstLine.replace(/^[-*]\s*/, "").trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

function updaterErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return String(err);
}

export function AppUpdaterProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AppUpdaterPhase>("idle");
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const readyRef = useRef(false);
  const pendingUpdateRef = useRef<Update | null>(null);

  const restartToUpdate = useCallback(async () => {
    await relaunch();
  }, []);

  const installPending = useCallback(async (update: Update) => {
    const versionLabel = update.version;
    const notes = releaseNotesPreview(update.body);
    setVersion(versionLabel);
    setPhase("downloading");
    setLastError(null);
    setStatusMessage(null);
    setProgressLabel(
      notes
        ? `Downloading v${versionLabel} — ${notes}`
        : `Downloading v${versionLabel}…`,
    );

    let downloaded = 0;
    let total: number | undefined;

    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength;
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        if (total && total > 0) {
          const pct = Math.min(100, Math.round((downloaded / total) * 100));
          setProgressLabel(`Downloading v${versionLabel}… ${pct}%`);
        }
      }
    });

    pendingUpdateRef.current = null;
    readyRef.current = true;
    setPhase("ready");
    setProgressLabel(null);
    setStatusMessage(`Update v${versionLabel} is ready. Restart to apply.`);
  }, []);

  const checkNow = useCallback(async () => {
    if (!isTauri()) {
      setLastError("Desktop updates require the Relaybase app.");
      return;
    }
    if (busyRef.current || readyRef.current) return;

    busyRef.current = true;
    setPhase("checking");
    setProgressLabel(null);
    setLastError(null);
    setStatusMessage(null);

    try {
      let installed = currentVersion;
      if (!installed) {
        installed = await getVersion();
        setCurrentVersion(installed);
      }

      const update = await check({ timeout: 60_000 });
      if (!update) {
        pendingUpdateRef.current = null;
        setPhase("idle");
        setVersion(null);
        setProgressLabel(null);
        setStatusMessage(`Desktop v${installed} is up to date.`);
        return;
      }

      pendingUpdateRef.current = update;
      setVersion(update.version);
      setPhase("available");
      setStatusMessage(
        `Desktop update available: v${installed} → v${update.version}`,
      );
    } catch (err) {
      console.error("[updater] Manual check failed:", err);
      const message = updaterErrorMessage(err);
      setPhase("idle");
      setVersion(null);
      setProgressLabel(null);
      setLastError(message);
      setStatusMessage(null);
      try {
        const { toast } = await import("sonner");
        toast.error(`Desktop update check failed: ${message}`);
      } catch {
        // ignore toast load errors
      }
    } finally {
      busyRef.current = false;
    }
  }, [currentVersion]);

  const installNow = useCallback(async () => {
    if (!isTauri()) {
      setLastError("Desktop updates require the Relaybase app.");
      return;
    }
    if (busyRef.current || readyRef.current) return;

    busyRef.current = true;
    setLastError(null);
    setStatusMessage(null);

    try {
      let update = pendingUpdateRef.current;
      if (!update) {
        setPhase("checking");
        update = await check({ timeout: 60_000 });
        if (!update) {
          setPhase("idle");
          setVersion(null);
          setStatusMessage(
            `Desktop v${currentVersion ?? (await getVersion())} is up to date.`,
          );
          return;
        }
        pendingUpdateRef.current = update;
        setVersion(update.version);
      }

      await installPending(update);
    } catch (err) {
      console.error("[updater] Download/install failed:", err);
      const message = updaterErrorMessage(err);
      setPhase(pendingUpdateRef.current ? "available" : "idle");
      setProgressLabel(null);
      setLastError(message);
      setStatusMessage(null);
      try {
        const { toast } = await import("sonner");
        toast.error(`Desktop update failed: ${message}`);
      } catch {
        // ignore toast load errors
      }
    } finally {
      busyRef.current = false;
    }
  }, [currentVersion, installPending]);

  useEffect(() => {
    if (!isTauri()) return;
    void getVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion(null));
  }, []);

  // Background auto-check (release builds only, main window only).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !isTauri()) {
      return;
    }

    try {
      if (getCurrentWindow().label !== "main") {
        return;
      }
    } catch {
      return;
    }

    let cancelled = false;
    let startupTimeout: ReturnType<typeof setTimeout> | undefined;
    let periodicId: ReturnType<typeof setInterval> | undefined;

    const attempt = async () => {
      if (cancelled || busyRef.current || readyRef.current) return;
      busyRef.current = true;
      setPhase("checking");
      setProgressLabel(null);
      setLastError(null);

      try {
        const update = await check({ timeout: 60_000 });
        if (cancelled || !update) {
          setPhase("idle");
          setVersion(null);
          setProgressLabel(null);
          return;
        }

        pendingUpdateRef.current = update;
        await installPending(update);
      } catch (err) {
        console.error("[updater] Update check/install failed:", err);
        if (!cancelled) {
          setPhase("idle");
          setVersion(null);
          setProgressLabel(null);
          setLastError(updaterErrorMessage(err));
          try {
            const { toast } = await import("sonner");
            toast.error(
              `Desktop update failed: ${updaterErrorMessage(err)}`,
            );
          } catch {
            // ignore toast load errors
          }
        }
      } finally {
        busyRef.current = false;
      }
    };

    startupTimeout = setTimeout(() => {
      void attempt();
      periodicId = setInterval(() => void attempt(), PERIODIC_CHECK_MS);
    }, STARTUP_DELAY_MS);

    return () => {
      cancelled = true;
      if (startupTimeout) clearTimeout(startupTimeout);
      if (periodicId) clearInterval(periodicId);
    };
  }, [installPending]);

  const value = useMemo(
    () => ({
      phase,
      currentVersion,
      version,
      progressLabel,
      statusMessage,
      lastError,
      checkNow,
      installNow,
      restartToUpdate,
    }),
    [
      phase,
      currentVersion,
      version,
      progressLabel,
      statusMessage,
      lastError,
      checkNow,
      installNow,
      restartToUpdate,
    ],
  );

  return (
    <AppUpdaterContext.Provider value={value}>{children}</AppUpdaterContext.Provider>
  );
}

export function useOptionalAppUpdater(): AppUpdaterContextValue | null {
  return useContext(AppUpdaterContext);
}
