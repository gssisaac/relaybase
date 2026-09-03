//! Local persistence and storage management under `~/.relaybase`.
//!
//! Submodules:
//! - `credentials`: Workspace credentials and team login persistence
//! - `layout`: Storage layout v2 (account-scoped directory trees) and path resolution
//! - `mail_store`: Local mail atom JSON, binary attachments, and cache JSON IO
//! - `memory_session`: Process-memory CF OAuth session state
//! - `prefs`: UI preferences (email colors, etc.)
//! - `vault`: Plaintext API key vault
//! - `webkit`: WebKit WebsiteData and OS cache cleanup for factory reset
//! - `commands`: Tauri IPC command bindings

pub mod commands;
pub mod credentials;
pub mod layout;
pub mod mail_store;
pub mod memory_session;
pub mod prefs;
pub mod vault;
pub mod webkit;

pub use commands::*;
pub use credentials::{
    clear_all_relaybase_data, clear_credentials, clear_team_login, load_credentials,
    load_credentials_merged, load_team_login, save_credentials, save_team_login,
    StoredCredentials, TeamLogin,
};
pub use layout::{
    current_scope_id, ensure_dir, home_dir, legacy_credentials_path, migrate_mail_to_desktop_user,
    migrate_storage_layout_v2, relaybase_dir, resolve_account_scope_id, scoped_dir, workspace_path,
    StorageLayoutMarker, API_KEYS_FILE, EMAIL_PREFS_FILE, LEGACY_CREDENTIALS_FILE,
    STORAGE_LAYOUT_MARKER_FILE, TEAM_LOGIN_FILE, WORKSPACE_FILE,
};
pub use mail_store::{
    delete_mail_binary, delete_mail_binary_dir, load_cache_json, load_mail_binary, load_mail_json,
    save_mail_binary,
};
pub use memory_session::{
    apply_cf_oauth_session, clear_cf_oauth_session, get_cf_oauth_session, set_cf_oauth_session,
    CfOAuthSession,
};
#[cfg(debug_assertions)]
pub use memory_session::hydrate_cf_oauth_session_dev_cache;
pub use prefs::{load_email_prefs, EmailPrefs};
pub use vault::{
    load_api_key_vault, remove_api_key_vault_entry, save_api_key_vault,
    upsert_api_key_vault_entry, ApiKeyVault, ApiKeyVaultEntry,
};
pub use webkit::clear_webkit_data;
