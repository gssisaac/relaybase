use super::credentials::{
    clear_all_relaybase_data, clear_credentials, clear_team_login, load_credentials,
    load_credentials_merged, load_team_login, save_credentials, save_team_login,
    StoredCredentials, TeamLogin,
};
use super::layout::{
    current_scope_id, migrate_mail_to_desktop_user, migrate_storage_layout_v2,
    StorageLayoutMarker,
};
use super::mail_store::{
    delete_mail_binary as delete_mail_binary_inner,
    delete_mail_binary_dir as delete_mail_binary_dir_inner,
    load_cache_json, load_mail_binary, load_mail_json, save_cache_json as save_cache_json_inner,
    save_mail_binary as save_mail_binary_inner, save_mail_json as save_mail_json_inner,
};
use super::memory_session::get_cf_oauth_session;
use super::prefs::{load_email_prefs, save_email_prefs as save_email_prefs_inner, EmailPrefs};
use super::vault::{
    load_api_key_vault, remove_api_key_vault_entry, upsert_api_key_vault_entry, ApiKeyVault,
    ApiKeyVaultEntry,
};
use super::webkit::clear_webkit_data;
use crate::auth::{owner_logout, team_logout};
use crate::cloudflare::load_keyring_oauth_refresh;

#[tauri::command]
pub async fn save_cf_credentials(account_id: String) -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.account_id = account_id.trim().to_string();
    save_credentials(&creds)?;
    load_credentials_merged()
}

#[tauri::command]
pub async fn get_credentials() -> Result<Option<StoredCredentials>, String> {
    let disk = load_credentials()?;
    if disk.is_none()
        && get_cf_oauth_session().is_none()
        && load_keyring_oauth_refresh().ok().flatten().is_none()
    {
        return Ok(None);
    }
    let creds = load_credentials_merged()?;
    Ok(Some(creds))
}

#[tauri::command]
pub async fn clear_stored_credentials() -> Result<(), String> {
    clear_credentials()
}

/// Wipe WebKit / OS-level data (LocalStorage, IndexedDB, caches, cookies)
/// that lives outside `~/.relaybase`. Used during factory reset so the app
/// returns to the initial install screen.
#[tauri::command]
pub async fn clear_webkit_data_cmd() -> Result<String, String> {
    clear_webkit_data()
}

/// Full factory reset: delete `~/.relaybase`, clear WebKit data, and wipe
/// in-memory session state. The OS keyring (owner-session, owner-passtoken,
/// team-session) is **not** cleared here — that is a separate explicit action
/// because it requires biometry / user confirmation on read-back paths.
///
/// After this command, the app should restart or re-render to show the
/// initial install screen.
#[tauri::command]
pub async fn factory_reset_cmd() -> Result<String, String> {
    // 1. Clear in-memory session state (owner access, team memory, CF OAuth).
    let _ = owner_logout().await;
    let _ = team_logout().await;

    // 2. Delete the entire ~/.relaybase directory tree.
    clear_all_relaybase_data()?;

    // 3. Wipe WebKit / OS-level data outside ~/.relaybase.
    let cleared = clear_webkit_data()?;

    Ok(format!("Factory reset complete. Cleared: {cleared}"))
}

#[tauri::command]
pub async fn get_email_prefs() -> Result<Option<EmailPrefs>, String> {
    load_email_prefs()
}

#[tauri::command]
pub async fn save_email_prefs(prefs: EmailPrefs) -> Result<(), String> {
    save_email_prefs_inner(&prefs)
}

#[tauri::command]
pub async fn get_api_key_vault() -> Result<ApiKeyVault, String> {
    load_api_key_vault()
}

#[tauri::command]
pub async fn save_api_key_vault_entry(entry: ApiKeyVaultEntry) -> Result<ApiKeyVault, String> {
    upsert_api_key_vault_entry(entry)
}

#[tauri::command]
pub async fn remove_api_key_vault_entry_cmd(id: String) -> Result<ApiKeyVault, String> {
    remove_api_key_vault_entry(id.trim())
}

#[tauri::command]
pub async fn migrate_mail_user_folder() -> Result<Option<String>, String> {
    migrate_mail_to_desktop_user()
}

#[tauri::command]
pub async fn get_account_scope_id() -> Result<String, String> {
    current_scope_id()
}

#[tauri::command]
pub async fn migrate_storage_layout() -> Result<StorageLayoutMarker, String> {
    migrate_storage_layout_v2()
}

#[tauri::command]
pub async fn get_mail_json(relative_path: String) -> Result<Option<serde_json::Value>, String> {
    load_mail_json(&relative_path)
}

#[tauri::command]
pub async fn save_mail_json(
    relative_path: String,
    value: serde_json::Value,
) -> Result<(), String> {
    save_mail_json_inner(&relative_path, &value)
}

#[tauri::command]
pub async fn get_mail_binary(relative_path: String) -> Result<Option<String>, String> {
    load_mail_binary(&relative_path)
}

#[tauri::command]
pub async fn save_mail_binary(
    relative_path: String,
    base64_data: String,
) -> Result<(), String> {
    save_mail_binary_inner(&relative_path, &base64_data)
}

#[tauri::command]
pub async fn delete_mail_binary(relative_path: String) -> Result<(), String> {
    delete_mail_binary_inner(&relative_path)
}

#[tauri::command]
pub async fn delete_mail_binary_dir(relative_path: String) -> Result<(), String> {
    delete_mail_binary_dir_inner(&relative_path)
}

#[tauri::command]
pub async fn get_cache_json(relative_path: String) -> Result<Option<serde_json::Value>, String> {
    load_cache_json(&relative_path)
}

#[tauri::command]
pub async fn save_cache_json(
    relative_path: String,
    value: serde_json::Value,
) -> Result<(), String> {
    save_cache_json_inner(&relative_path, &value)
}

#[tauri::command]
pub async fn save_relaybase_account(
    account_id: String,
    email: String,
    session: String,
) -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.relaybase_account_id = account_id.trim().to_string();
    creds.relaybase_email = email.trim().to_string();
    creds.relaybase_session = session.trim().to_string();
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
pub async fn clear_relaybase_account() -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.relaybase_account_id.clear();
    creds.relaybase_email.clear();
    creds.relaybase_session.clear();
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
pub async fn get_team_login() -> Result<Option<TeamLogin>, String> {
    load_team_login()
}

#[tauri::command]
pub async fn save_team_login_cmd(
    worker_url: String,
    account_email: String,
    #[allow(unused_variables)] mobile_password: String,
) -> Result<TeamLogin, String> {
    // Identity-only on disk. The password is stored in the OS keyring by
    // `team_login_cmd` (team_session.rs). Kept for call-site compatibility.
    let login = TeamLogin {
        worker_url: worker_url.trim().trim_end_matches('/').to_string(),
        account_email: account_email.trim().to_lowercase(),
        mobile_password: String::new(),
    };
    save_team_login(&login)?;
    Ok(login)
}

#[tauri::command]
pub async fn clear_team_login_cmd() -> Result<(), String> {
    clear_team_login()
}
