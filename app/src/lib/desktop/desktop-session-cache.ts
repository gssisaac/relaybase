import type {
  DesktopCredentials,
  DesktopTeamLogin,
} from "@/lib/desktop/bridge";

/** Survives layout remounts after packaged static navigations. */
export type DesktopSessionSnapshot = {
  isDesktop: boolean;
  ready: boolean;
  credentials: DesktopCredentials | null;
  teamLogin: DesktopTeamLogin | null;
};

let cachedSession: DesktopSessionSnapshot | null = null;

export function readDesktopSessionCache(): DesktopSessionSnapshot | null {
  return cachedSession;
}

export function writeDesktopSessionCache(
  snapshot: DesktopSessionSnapshot,
): void {
  cachedSession = snapshot;
}

export function clearDesktopSessionCache(): void {
  cachedSession = null;
}
