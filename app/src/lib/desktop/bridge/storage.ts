import { invoke, isDesktopRuntime } from "./invoke";

export type DesktopEmailPrefs = {
  version: number;
  accountColors: Record<string, string>;
  signatures?: Record<string, string>;
};

export async function desktopGetEmailPrefs(): Promise<DesktopEmailPrefs | null> {
  return invoke("get_email_prefs");
}

export async function desktopSaveEmailPrefs(
  prefs: DesktopEmailPrefs,
): Promise<void> {
  return invoke("save_email_prefs", { prefs });
}

/** Read JSON from `~/.relaybase/mail/{relativePath}`. */
export async function desktopGetMailJson(
  relativePath: string,
): Promise<unknown | null> {
  return invoke("get_mail_json", { relativePath });
}

/** Write JSON to `~/.relaybase/mail/{relativePath}`. */
export async function desktopSaveMailJson(
  relativePath: string,
  value: unknown,
): Promise<void> {
  return invoke("save_mail_json", { relativePath, value });
}

/** Read JSON from `~/.relaybase/cache/{relativePath}`. */
export async function desktopGetCacheJson(
  relativePath: string,
): Promise<unknown | null> {
  return invoke("get_cache_json", { relativePath });
}

/** Write JSON to `~/.relaybase/cache/{relativePath}`. */
export async function desktopSaveCacheJson(
  relativePath: string,
  value: unknown,
): Promise<void> {
  return invoke("save_cache_json", { relativePath, value });
}

export type DesktopApiKeyVaultEntry = {
  id: string;
  domain: string;
  label: string | null;
  apiKey: string;
  createdAt: string;
};

export type DesktopApiKeyVault = {
  version: number;
  entries: DesktopApiKeyVaultEntry[];
};

const BROWSER_API_KEY_VAULT = "relaybase:api-keys-vault:v1";

function loadBrowserApiKeyVault(): DesktopApiKeyVault {
  if (typeof window === "undefined") return { version: 1, entries: [] };
  try {
    const raw = localStorage.getItem(BROWSER_API_KEY_VAULT);
    if (!raw) return { version: 1, entries: [] };
    const parsed = JSON.parse(raw) as DesktopApiKeyVault;
    return {
      version: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { version: 1, entries: [] };
  }
}

function saveBrowserApiKeyVault(vault: DesktopApiKeyVault) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BROWSER_API_KEY_VAULT, JSON.stringify(vault));
  } catch {
    /* ignore */
  }
}

export async function desktopGetApiKeyVault(): Promise<DesktopApiKeyVault> {
  if (!isDesktopRuntime()) {
    return loadBrowserApiKeyVault();
  }
  return invoke("get_api_key_vault");
}

export async function desktopSaveApiKeyVaultEntry(
  entry: DesktopApiKeyVaultEntry,
): Promise<DesktopApiKeyVault> {
  if (!isDesktopRuntime()) {
    const vault = loadBrowserApiKeyVault();
    const next = {
      version: 1,
      entries: [
        entry,
        ...vault.entries.filter((e) => e.id !== entry.id),
      ],
    };
    saveBrowserApiKeyVault(next);
    return next;
  }
  return invoke("save_api_key_vault_entry", { entry });
}

export async function desktopRemoveApiKeyVaultEntry(
  id: string,
): Promise<DesktopApiKeyVault> {
  if (!isDesktopRuntime()) {
    const vault = loadBrowserApiKeyVault();
    const next = {
      version: 1,
      entries: vault.entries.filter((e) => e.id !== id),
    };
    saveBrowserApiKeyVault(next);
    return next;
  }
  return invoke("remove_api_key_vault_entry_cmd", { id });
}

/** One-shot mail/{oldCookieUser} → mail/desktop rename. */
export async function desktopMigrateMailUserFolder(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return invoke("migrate_mail_user_folder");
}

/** Opaque account-scope id (`s-{16hex}`) for the current session. */
export async function desktopGetAccountScopeId(): Promise<string> {
  if (!isDesktopRuntime()) return "s-legacy";
  return invoke("get_account_scope_id");
}

/** One-shot flat→scoped layout migration. Idempotent. */
export async function desktopMigrateStorageLayout(): Promise<void> {
  if (!isDesktopRuntime()) return;
  await invoke("migrate_storage_layout");
}
