"use client";

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

import { isDesktopRuntime } from "@/lib/desktop/bridge";

const STARTUP_DELAY_MS = 8_000;
const PERIODIC_CHECK_MS = 24 * 60 * 60 * 1000;

export type AppUpdaterPhase = "idle" | "checking" | "downloading" | "ready";

type AppUpdaterContextValue = {
  phase: AppUpdaterPhase;
  version: string | null;
  progressLabel: string | null;
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

export function AppUpdaterProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AppUpdaterPhase>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const busyRef = useRef(false);
  const readyRef = useRef(false);

  const restartToUpdate = useCallback(async () => {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!isDesktopRuntime()) return;

    let cancelled = false;
    let startupTimeout: ReturnType<typeof setTimeout> | undefined;
    let periodicId: ReturnType<typeof setInterval> | undefined;

    const attempt = async () => {
      if (cancelled || busyRef.current || readyRef.current) return;
      busyRef.current = true;
      setPhase("checking");
      setProgressLabel(null);

      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        if (getCurrentWindow().label !== "main") {
          setPhase("idle");
          return;
        }

        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check({ timeout: 60_000 });
        if (cancelled || !update) {
          setPhase("idle");
          setVersion(null);
          setProgressLabel(null);
          return;
        }

        const notes = releaseNotesPreview(update.body);
        const versionLabel = update.version;
        setVersion(versionLabel);
        setPhase("downloading");
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

        if (cancelled) return;

        readyRef.current = true;
        setPhase("ready");
        setProgressLabel(null);
        const { toast } = await import("sonner");
        toast.message(`Relaybase v${versionLabel} is ready`, {
          duration: Infinity,
          action: {
            label: "Restart",
            onClick: () => {
              void restartToUpdate();
            },
          },
        });
      } catch {
        if (!cancelled) {
          setPhase("idle");
          setVersion(null);
          setProgressLabel(null);
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
  }, []);

  const value = useMemo(
    () => ({ phase, version, progressLabel, restartToUpdate }),
    [phase, version, progressLabel, restartToUpdate],
  );

  return (
    <AppUpdaterContext.Provider value={value}>{children}</AppUpdaterContext.Provider>
  );
}

export function useOptionalAppUpdater(): AppUpdaterContextValue | null {
  return useContext(AppUpdaterContext);
}
