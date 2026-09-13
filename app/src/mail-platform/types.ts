/**
 * Mail platform facade — platform-agnostic types.
 *
 * The `email/` UI talks only to these ports. Concrete implementations live
 * under `mail-platform/{transport,session,storage,shell}` and are selected
 * by `runtime/build-runtime.ts` based on the build flavor
 * (`email` web-only vs `console` desktop).
 *
 * Naming: `email` mode = mail-only (web or desktop-without-console),
 * `console` mode = full desktop with owner dashboard. We avoid `team`/`owner`
 * because an owner using the web build also lands in `email` mode.
 */

// --- Transport (items 1, 11) ---------------------------------------------

export type MailTransport = {
  /**
   * Fetch a mail API path. Callers pass UI-relative paths
   * (`/api/email/inbox?domain=...`); the transport maps them to the
   * correct Worker route (`/mail/*` for console, `/mobile/*` for email)
   * and attaches auth headers.
   */
  fetch(path: string, init?: RequestInit): Promise<Response>;
  /** True when a Worker URL is connected (credentials loaded). */
  readonly isWorkerBacked: boolean;
};

// --- Session (items 2, 3, 5, 9) -------------------------------------------

export type EmailIdentity = {
  workerUrl: string;
  accountEmail: string;
};

export type MailSession = {
  readonly ready: boolean;
  readonly identity: EmailIdentity | null;
  /** Login with account email + per-account mobile password. */
  login(input: EmailIdentity & { mobilePassword: string }): Promise<void>;
  logout(): Promise<void>;
  /** Subscribe to identity/ready changes; returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
};

// --- Storage (item 4) ------------------------------------------------------

export type MailStorage = {
  readJson(relativePath: string): Promise<unknown | null>;
  writeJson(relativePath: string, value: unknown): Promise<void>;
  readBinary(relativePath: string): Promise<ArrayBuffer | null>;
  writeBinary(relativePath: string, value: ArrayBuffer): Promise<void>;
  deleteBinary(relativePath: string): Promise<void>;
  deleteBinaryDir(relativePath: string): Promise<void>;
};

// --- Platform / OS (item 6) ----------------------------------------------

export type MailPlatform = {
  notifyNewMail(items: NewMailNotifyItem[]): Promise<void>;
  setTrayUnread(hasUnread: boolean): Promise<void>;
  openExternal(url: string): Promise<void>;
  openAttachment(filename: string, data: Uint8Array): Promise<void>;
};

export type NewMailNotifyItem = {
  from: string;
  subject: string;
  messageId: string;
  account?: string | null;
};

// --- Shell chrome (items 7, 8) -------------------------------------------

export type MailShellChrome = {
  /** Whether the platform draws a window drag region / title bar. */
  readonly isDesktop: boolean;
  readonly isMacOS: boolean;
  /** Props to spread on draggable surfaces (empty on web). */
  dragRegionProps: Record<string, string>;
  dragRegionClassName: string;
  noDragClassName: string;
};

// --- Features (item 9) ----------------------------------------------------

export type MailFeatures = {
  /** Console (owner dashboard) is available in this build. */
  console: boolean;
  /** Multiple accounts switcher (false in email-only web). */
  multiAccount: boolean;
  /** Enable-Email-API onboarding dialog (console only). */
  enableEmailApiOnboarding: boolean;
};

// --- Runtime bundle -------------------------------------------------------

export type MailRuntime = {
  transport: MailTransport;
  session: MailSession;
  storage: MailStorage;
  platform: MailPlatform;
  chrome: MailShellChrome;
  features: MailFeatures;
  /** Opaque account-scope id — changes on account switch. */
  accountScopeId: string;
};

// --- Errors ----------------------------------------------------------------

export type MailErrorKind =
  | "auth"
  | "network"
  | "not-wired"
  | "worker-unavailable"
  | "unknown";
