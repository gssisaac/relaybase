/**
 * Mail platform facade — platform-agnostic mail runtime.
 *
 * The `email/` UI talks only to the ports defined here. Concrete
 * implementations are selected by the build flavor:
 *
 * - `email` mode (web-only / desktop-without-console): `EmailAppProviders`
 *   assembles `createEmailTransport` (`/mobile/*`), `EmailSessionStore`,
 *   `createWebStorage`, `createWebPlatform`, `createWebChrome`.
 *
 * - `console` mode (full desktop with owner dashboard): the existing
 *   `AppProviders` (DesktopProvider + AppSessionProvider) drives the
 *   runtime; `createConsoleTransport` delegates to `desktopAwareFetch`.
 *
 * Naming: `email` vs `console` (not `team` vs `owner`) because an owner
 * using the web build also lands in `email` mode.
 *
 * See `docs/refactoring/mail-platform.md` for the full migration plan.
 */

export type {
  MailTransport,
  MailSession,
  EmailIdentity,
  MailStorage,
  MailPlatform,
  MailShellChrome,
  MailFeatures,
  MailRuntime,
  MailErrorKind,
  NewMailNotifyItem,
} from "./types";

export {
  createEmailTransport,
  createConsoleTransport,
  mapEmailApiToMobile,
  isEmailApiPath,
  API_UNAVAILABLE,
  API_NOT_WIRED,
} from "./transport";

export {
  EmailSessionStore,
  createEmailSession,
  useConsoleSession,
  type ConsoleSessionAdapter,
} from "./session";

export { createWebStorage, createDesktopStorage } from "./storage";

export {
  createWebPlatform,
  createDesktopPlatform,
  createWebChrome,
  useDesktopChromeAdapter,
} from "./shell";

export {
  MailRuntimeProvider,
  useMailRuntime,
  useOptionalMailRuntime,
  EmailAppProviders,
} from "./runtime";
