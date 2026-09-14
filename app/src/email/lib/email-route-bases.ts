import { isDesktopRuntime } from "@/lib/desktop/bridge";

export type EmailFolder =
  | "compose"
  | "inbox"
  | "drafts"
  | "sent"
  | "trash"
  | "settings";

/** Mail under the dashboard shell (`/email/*`) vs web team mail (`/inbox`, …). */
export function isShellEmailPath(pathname: string): boolean {
  return (
    pathname === "/email" ||
    pathname.startsWith("/email/") ||
    pathname === "/emails" ||
    pathname.startsWith("/emails/")
  );
}

export function usesShellEmailRoutes(pathname: string): boolean {
  return isDesktopRuntime() || isShellEmailPath(pathname);
}

function shellFolderPath(
  folder: Exclude<EmailFolder, "compose" | "settings">,
): string {
  return folder === "inbox"
    ? "/email/inbox"
    : folder === "drafts"
      ? "/email/drafts"
      : folder === "sent"
        ? "/email/sent"
        : "/email/trash";
}

export function emailFolderBasePath(
  folder: Exclude<EmailFolder, "compose" | "settings">,
  pathname: string,
): string {
  return usesShellEmailRoutes(pathname)
    ? shellFolderPath(folder)
    : `/${folder}`;
}

export function emailComposeBasePath(pathname: string): string {
  return usesShellEmailRoutes(pathname) ? "/email/compose" : "/compose";
}
