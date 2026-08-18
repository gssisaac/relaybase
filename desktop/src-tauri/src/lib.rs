mod auto_install;
mod cloudflare;
mod notify;
mod secrets;
mod worker;

use auto_install::{auto_install_worker, merge_into_credentials, AutoInstallResult};
use cloudflare::{list_zones, verify_token, ZoneSummary};
use secrets::{
    clear_credentials, clear_team_login, load_api_key_vault, load_cache_json as read_cache_json,
    load_credentials, load_email_prefs, load_mail_json as read_mail_json, load_team_login,
    migrate_mail_to_desktop_user, remove_api_key_vault_entry, save_cache_json as write_cache_json,
    save_credentials, save_email_prefs as write_email_prefs, save_mail_json as write_mail_json,
    save_team_login, upsert_api_key_vault_entry, ApiKeyVault, ApiKeyVaultEntry, EmailPrefs,
    StoredCredentials, TeamLogin,
};
use worker::{adopt_worker, install_worker, probe_install, update_worker, InstallResult, ProbeResult};

#[tauri::command]
async fn save_cf_credentials(
    account_id: String,
    api_token: String,
) -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.account_id = account_id.trim().to_string();
    creds.api_token = api_token.trim().to_string();
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
async fn get_credentials() -> Result<Option<StoredCredentials>, String> {
    load_credentials()
}

#[tauri::command]
async fn clear_stored_credentials() -> Result<(), String> {
    clear_credentials()
}

#[tauri::command]
async fn get_email_prefs() -> Result<Option<EmailPrefs>, String> {
    load_email_prefs()
}

#[tauri::command]
async fn save_email_prefs(prefs: EmailPrefs) -> Result<(), String> {
    write_email_prefs(&prefs)
}

#[tauri::command]
async fn get_api_key_vault() -> Result<ApiKeyVault, String> {
    load_api_key_vault()
}

#[tauri::command]
async fn save_api_key_vault_entry(entry: ApiKeyVaultEntry) -> Result<ApiKeyVault, String> {
    upsert_api_key_vault_entry(entry)
}

#[tauri::command]
async fn remove_api_key_vault_entry_cmd(id: String) -> Result<ApiKeyVault, String> {
    remove_api_key_vault_entry(id.trim())
}

#[tauri::command]
async fn migrate_mail_user_folder() -> Result<Option<String>, String> {
    migrate_mail_to_desktop_user()
}

#[tauri::command]
async fn get_mail_json(relative_path: String) -> Result<Option<serde_json::Value>, String> {
    read_mail_json(&relative_path)
}

#[tauri::command]
async fn save_mail_json(
    relative_path: String,
    value: serde_json::Value,
) -> Result<(), String> {
    write_mail_json(&relative_path, &value)
}

#[tauri::command]
async fn get_cache_json(relative_path: String) -> Result<Option<serde_json::Value>, String> {
    read_cache_json(&relative_path)
}

#[tauri::command]
async fn save_cache_json(
    relative_path: String,
    value: serde_json::Value,
) -> Result<(), String> {
    write_cache_json(&relative_path, &value)
}

#[tauri::command]
async fn verify_cf_token(account_id: String, api_token: String) -> Result<cloudflare::TokenVerifyResult, String> {
    verify_token(account_id.trim(), api_token.trim()).await
}

#[tauri::command]
async fn list_cf_zones() -> Result<Vec<ZoneSummary>, String> {
    let creds = load_credentials()?.ok_or("No credentials stored")?;
    let client = cloudflare::CfClient {
        account_id: creds.account_id,
        api_token: creds.api_token,
    };
    list_zones(&client).await
}

#[tauri::command]
async fn probe_routing_worker() -> Result<ProbeResult, String> {
    let creds = load_credentials()?.ok_or("Connect Cloudflare first")?;
    if creds.account_id.is_empty() || creds.api_token.is_empty() {
        return Err("Connect Cloudflare first".into());
    }
    probe_install(&creds.account_id, &creds.api_token).await
}

#[tauri::command]
async fn adopt_routing_worker() -> Result<InstallResult, String> {
    let creds = load_credentials()?.ok_or("Connect Cloudflare first")?;
    let (result, next) = adopt_worker(&creds.account_id, &creds.api_token, &creds).await?;
    save_credentials(&next)?;
    Ok(result)
}

#[tauri::command]
async fn install_routing_worker(worker_js: Option<String>) -> Result<InstallResult, String> {
    let creds = load_credentials()?.ok_or("Connect Cloudflare first")?;
    let (result, next) =
        install_worker(&creds.account_id, &creds.api_token, worker_js, &creds).await?;
    save_credentials(&next)?;
    Ok(result)
}

#[tauri::command]
async fn update_routing_worker(worker_js: Option<String>) -> Result<InstallResult, String> {
    let creds = load_credentials()?.ok_or("Connect Cloudflare first")?;
    let result = update_worker(&creds, worker_js).await?;
    Ok(result)
}

#[tauri::command]
async fn save_license_key(license_key: String) -> Result<(), String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.license_key = license_key.trim().to_string();
    save_credentials(&creds)
}

#[tauri::command]
async fn save_relaybase_account(
    account_id: String,
    email: String,
    session: String,
    tier: Option<String>,
) -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.relaybase_account_id = account_id.trim().to_string();
    creds.relaybase_email = email.trim().to_string();
    creds.relaybase_session = session.trim().to_string();
    creds.relaybase_tier = tier.unwrap_or_default().trim().to_string();
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
async fn clear_relaybase_account() -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.relaybase_account_id.clear();
    creds.relaybase_email.clear();
    creds.relaybase_session.clear();
    creds.relaybase_tier.clear();
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
async fn get_team_login() -> Result<Option<TeamLogin>, String> {
    load_team_login()
}

#[tauri::command]
async fn save_team_login_cmd(
    worker_url: String,
    account_email: String,
    mobile_password: String,
) -> Result<TeamLogin, String> {
    let login = TeamLogin {
        worker_url: worker_url.trim().trim_end_matches('/').to_string(),
        account_email: account_email.trim().to_lowercase(),
        mobile_password: mobile_password,
    };
    save_team_login(&login)?;
    Ok(login)
}

#[tauri::command]
async fn clear_team_login_cmd() -> Result<(), String> {
    clear_team_login()
}

/// Background auto-install of the routing Worker into the user's Cloudflare
/// account via wrangler. Streams `install-log` events to the frontend.
#[tauri::command]
async fn auto_install_routing_worker(
    app: tauri::AppHandle,
    api_token: String,
    account_id: Option<String>,
) -> Result<AutoInstallResult, String> {
    let result = auto_install_worker(app, api_token, account_id.clone()).await?;
    let existing = load_credentials()?.unwrap_or_default();
    let next = merge_into_credentials(&existing, &result, account_id);
    save_credentials(&next)?;
    Ok(result)
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct D1BindingSnapshot {
    configured: bool,
    database_name: String,
    binding: String,
    size_bytes: Option<u64>,
}

impl Default for D1BindingSnapshot {
    fn default() -> Self {
        Self {
            configured: false,
            database_name: String::new(),
            binding: String::new(),
            size_bytes: None,
        }
    }
}

fn default_d1_logs() -> D1BindingSnapshot {
    D1BindingSnapshot {
        configured: false,
        database_name: "relaybase-logs".into(),
        binding: "RELAYBASE_LOGS".into(),
        size_bytes: None,
    }
}

fn default_d1_inbox_index() -> D1BindingSnapshot {
    D1BindingSnapshot {
        configured: false,
        database_name: "relaybase-inbox-index".into(),
        binding: "RELAYBASE_INBOX_INDEX".into(),
        size_bytes: None,
    }
}

fn parse_d1_binding(value: &serde_json::Value, kind: &str) -> D1BindingSnapshot {
    let defaults = if kind == "logs" {
        default_d1_logs()
    } else {
        default_d1_inbox_index()
    };
    let Some(d1) = value.get("d1") else {
        return defaults;
    };

    if let Some(nested) = d1.get(kind) {
        return D1BindingSnapshot {
            configured: nested
                .get("configured")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            database_name: nested
                .get("databaseName")
                .and_then(|v| v.as_str())
                .unwrap_or(defaults.database_name.as_str())
                .into(),
            binding: nested
                .get("binding")
                .and_then(|v| v.as_str())
                .unwrap_or(defaults.binding.as_str())
                .into(),
            size_bytes: nested.get("sizeBytes").and_then(|v| v.as_u64()),
        };
    }

    if kind == "logs" {
        D1BindingSnapshot {
            configured: d1
                .get("logsConfigured")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            database_name: d1
                .get("logsDatabaseName")
                .and_then(|v| v.as_str())
                .unwrap_or("relaybase-logs")
                .into(),
            binding: "RELAYBASE_LOGS".into(),
            size_bytes: None,
        }
    } else {
        D1BindingSnapshot {
            configured: d1
                .get("inboxIndexConfigured")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            database_name: d1
                .get("inboxIndexDatabaseName")
                .and_then(|v| v.as_str())
                .unwrap_or("relaybase-inbox-index")
                .into(),
            binding: "RELAYBASE_INBOX_INDEX".into(),
            size_bytes: None,
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerConnectResult {
    ok: bool,
    product: String,
    worker_script_name: String,
    worker_url: String,
    r2_configured: bool,
    inbound_bucket_name: String,
    /// Sum of object sizes in the inbound R2 bucket (bytes). None if unknown.
    r2_total_bytes: Option<u64>,
    r2_object_count: Option<u64>,
    /// True when the Worker stopped scanning early (large bucket).
    r2_usage_truncated: Option<bool>,
    d1_logs: D1BindingSnapshot,
    d1_inbox_index: D1BindingSnapshot,
}

fn normalize_worker_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Worker URL is required".into());
    }
    let with_scheme = if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let url = reqwest::Url::parse(&with_scheme).map_err(|_| {
        "Worker URL looks invalid. Use https://relaybase-api.<subdomain>.workers.dev".to_string()
    })?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("Worker URL must be http(s)".into());
    }
    Ok(with_scheme.trim_end_matches('/').to_string())
}

async fn probe_d1_when_connect_omits(
    http: &reqwest::Client,
    base: &str,
    token: &str,
) -> (bool, bool) {
    let auth = format!("Bearer {token}");
    let mut logs_configured = false;
    let mut inbox_configured = false;

    if let Ok(res) = http
        .get(format!("{base}/health"))
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if json.get("d1").is_some() {
                    logs_configured = json
                        .pointer("/d1/logsConfigured")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    inbox_configured = json
                        .pointer("/d1/inboxIndexConfigured")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    return (logs_configured, inbox_configured);
                }
            }
        }
    }

    if let Ok(res) = http
        .get(format!("{base}/console/ops-logs?limit=1"))
        .header("Authorization", &auth)
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(v) = json.get("d1Configured").and_then(|v| v.as_bool()) {
                    logs_configured = v;
                } else if json
                    .pointer("/summary/total")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0)
                    > 0
                {
                    logs_configured = true;
                }
            }
        }
    }

    if let Ok(res) = http
        .get(format!("{base}/console/domains"))
        .header("Authorization", &auth)
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                let domain = json.get("domains").and_then(|domains| {
                    domains.as_array().and_then(|entries| {
                        entries.iter().find_map(|entry| {
                            entry
                                .get("domain")
                                .and_then(|v| v.as_str())
                                .map(str::trim)
                                .filter(|s| !s.is_empty())
                                .map(|s| s.to_string())
                        })
                    })
                });
                if let Some(domain) = domain {
                    if let Ok(search) = http
                        .get(format!(
                            "{base}/mail/inbox/search?domain={domain}&q=te&limit=1"
                        ))
                        .header("Authorization", &auth)
                        .send()
                        .await
                    {
                        inbox_configured = search.status().as_u16() != 503;
                    }
                }
            }
        }
    }

    (logs_configured, inbox_configured)
}

/// Verify user-deployed Worker via GET /console/connect (admin Bearer).
#[tauri::command]
async fn verify_worker_connection(
    worker_url: String,
    admin_token: String,
) -> Result<WorkerConnectResult, String> {
    let base = normalize_worker_url(&worker_url)?;
    let token = admin_token.trim();
    if token.is_empty() {
        return Err("Admin token is required (same value as wrangler secret ADMIN_TOKEN)".into());
    }

    let url = format!("{base}/console/connect");
    let http = reqwest::Client::new();
    let res = http
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Could not reach Worker ({e}). Check the URL and your network."))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(
            "Admin token was rejected by the Worker. Use the same value you set with `wrangler secret put ADMIN_TOKEN`."
                .into(),
        );
    }
    if !status.is_success() {
        return Err(format!(
            "Worker connect check failed (HTTP {}). Is this a Relaybase Worker URL?",
            status.as_u16()
        ));
    }

    let value: serde_json::Value =
        serde_json::from_str(&body).map_err(|_| {
            "Worker responded, but not with a Relaybase connect payload. Confirm you deployed the install package.".to_string()
        })?;

    if value.get("ok") != Some(&serde_json::Value::Bool(true))
        || value.get("product").and_then(|v| v.as_str()) != Some("relaybase")
    {
        return Err(
            "This URL is reachable but does not look like a Relaybase Worker. Redeploy the install package."
                .into(),
        );
    }

    let usage = value.pointer("/inbound/usage");
    let mut d1_logs = parse_d1_binding(&value, "logs");
    let mut d1_inbox_index = parse_d1_binding(&value, "inboxIndex");

    if value.get("d1").is_none()
        && !d1_logs.configured
        && !d1_inbox_index.configured
    {
        let (logs, inbox) = probe_d1_when_connect_omits(&http, &base, token).await;
        d1_logs.configured = logs;
        d1_inbox_index.configured = inbox;
    }

    Ok(WorkerConnectResult {
        ok: true,
        product: "relaybase".into(),
        worker_script_name: value
            .get("workerScriptName")
            .and_then(|v| v.as_str())
            .unwrap_or("relaybase-api")
            .into(),
        worker_url: base,
        r2_configured: value
            .pointer("/inbound/r2Configured")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        inbound_bucket_name: value
            .pointer("/inbound/bucketName")
            .and_then(|v| v.as_str())
            .unwrap_or("relaybase-inbound")
            .into(),
        r2_total_bytes: usage
            .and_then(|u| u.get("totalBytes"))
            .and_then(|v| v.as_u64()),
        r2_object_count: usage
            .and_then(|u| u.get("objectCount"))
            .and_then(|v| v.as_u64()),
        r2_usage_truncated: usage
            .and_then(|u| u.get("truncated"))
            .and_then(|v| v.as_bool()),
        d1_logs,
        d1_inbox_index,
    })
}

#[tauri::command]
async fn save_worker_connection(
    worker_url: String,
    admin_token: String,
    worker_script_name: Option<String>,
) -> Result<StoredCredentials, String> {
    let base = normalize_worker_url(&worker_url)?;
    let token = admin_token.trim();
    if token.is_empty() {
        return Err("Admin token is required".into());
    }
    // Prefer merging into existing creds, but never block a successful verify
    // on a legacy/unreadable credentials.json — overwrite with what we know.
    let mut creds = match load_credentials() {
        Ok(existing) => existing.unwrap_or_default(),
        Err(e) => {
            log::warn!("load_credentials failed during save_worker_connection: {e}");
            StoredCredentials::default()
        }
    };
    creds.worker_url = base;
    creds.admin_token = token.to_string();
    creds.worker_script_name = worker_script_name
        .unwrap_or_default()
        .trim()
        .to_string();
    if creds.worker_script_name.is_empty() {
        creds.worker_script_name = "relaybase-api".into();
    }
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
async fn get_desktop_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "isDesktop": true,
        "product": "Relaybase",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Open an http(s) URL in the system browser. Used both by the
/// `open_external_url` IPC command and the webview `on_new_window` handler
/// (email `<a target="_blank">` links must not open an in-app window).
fn open_url_in_os_browser(url: &str) -> Result<(), String> {
    let url = url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Only http(s) URLs can be opened".into());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| format!("Failed to open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        let _ = url;
        Err("Opening external URLs is not supported on this platform".into())
    }
}

/// Open https links in the system browser (webview <a target=_blank> is blocked).
#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    open_url_in_os_browser(&url)
}

/// Open an attachment with the OS default application. The frontend base64-encodes
/// the attachment bytes (already fetched via the authenticated blob URL) and
/// passes them here; we decode, write a temp file with the original extension,
/// and hand it to the OS opener so Preview / Acrobat / Photos opens it directly.
#[tauri::command]
async fn open_local_file_with_default_app(name: String, base64_data: String) -> Result<(), String> {
    use base64::Engine as _;
    let bytes = base64::prelude::BASE64_STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("Invalid attachment data: {e}"))?;
    let ext = name
        .rsplit('.')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("bin");
    let temp = std::env::temp_dir()
        .join(format!("relaybase-attach-{}.{ext}", uuid::Uuid::new_v4()));
    std::fs::write(&temp, &bytes)
        .map_err(|e| format!("Failed to write temp file: {e}"))?;
    open::that(&temp).map_err(|e| format!("Failed to open file: {e}"))?;
    Ok(())
}

fn downloads_dir() -> std::path::PathBuf {
    dirs::download_dir().unwrap_or_else(std::env::temp_dir)
}

fn unique_download_path(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
    let safe_name = name
        .trim()
        .replace(['/', '\\'], "_")
        .chars()
        .filter(|c| *c != '\0')
        .collect::<String>();
    let safe_name = if safe_name.is_empty() {
        "download".into()
    } else {
        safe_name
    };
    let mut candidate = dir.join(&safe_name);
    if !candidate.exists() {
        return candidate;
    }
    let path = std::path::Path::new(&safe_name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("download");
    let ext = path.extension().and_then(|s| s.to_str());
    for i in 1..100 {
        let next = match ext {
            Some(ext) if !ext.is_empty() => format!("{stem} ({i}).{ext}"),
            _ => format!("{stem} ({i})"),
        };
        candidate = dir.join(next);
        if !candidate.exists() {
            return candidate;
        }
    }
    dir.join(format!(
        "{stem}-{}.{ext}",
        uuid::Uuid::new_v4(),
        ext = ext.unwrap_or("bin")
    ))
}

/// Save a downloaded attachment to the user's Downloads folder and return the path.
#[tauri::command]
async fn save_download_file(name: String, base64_data: String) -> Result<String, String> {
    use base64::Engine as _;
    let bytes = base64::prelude::BASE64_STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("Invalid attachment data: {e}"))?;
    let path = unique_download_path(&downloads_dir(), &name);
    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to save download: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Open a local file path with the OS default application.
#[tauri::command]
async fn open_file_path(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("File path is empty".into());
    }
    open::that(path).map_err(|e| format!("Failed to open file: {e}"))
}

/// Reveal a downloaded file in the system file manager.
#[tauri::command]
async fn reveal_file_in_folder(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("File path is empty".into());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", path])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", path])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {e}"))?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let parent = std::path::Path::new(path)
            .parent()
            .ok_or_else(|| "File has no parent folder".to_string())?;
        open::that(parent).map_err(|e| format!("Failed to open folder: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        let _ = path;
        Err("Reveal in folder is not supported on this platform".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Seed ~/.relaybase/icon.png for notification identity image.
            if let Err(e) = notify::ensure_notification_icon() {
                log::warn!("notification icon seed failed: {e}");
            }

            // Build the main window programmatically (rather than via the
            // tauri.conf.json `app.windows` array) so we can attach an
            // `on_new_window` handler. Email HTML is rendered in a sandboxed
            // <iframe sandbox="allow-same-origin allow-popups">; links use
            // target="_blank", which the webview turns into a new-window
            // request. Route those to the system browser and deny the in-app
            // window so external links never open inside Relaybase.
            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Relaybase")
            .inner_size(1280.0, 840.0)
            .min_inner_size(960.0, 640.0)
            .resizable(true)
            .fullscreen(false)
            .decorations(true)
            .accept_first_mouse(true)
            .disable_drag_drop_handler()
            .zoom_hotkeys_enabled(false);

            // macOS-only window chrome options. These Tauri 2.x builder
            // methods are gated to macOS; calling them unconditionally breaks
            // `cargo check` on Linux/Windows.
            #[cfg(target_os = "macos")]
            let builder = builder
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true)
                .traffic_light_position(tauri::LogicalPosition::new(14.0, 21.0));

            builder
            .on_new_window(move |url, _features| {
                let s = url.as_str().to_string();
                if s.starts_with("http://") || s.starts_with("https://") {
                    if let Err(e) = open_url_in_os_browser(&s) {
                        log::warn!("open_external_url failed: {e}");
                    }
                }
                tauri::webview::NewWindowResponse::Deny
            })
            // Safety net: if a link ever navigates the main webview itself
            // (e.g. a top-level <a> without target, or an iframe whose
            // in-place navigation bubbles up), deny the in-app load and
            // route the URL to the system browser. App-internal navigations
            // (dev server / static export) are still allowed.
            .on_navigation(move |url| {
                let s = url.as_str().to_string();
                if s.starts_with("http://") || s.starts_with("https://") {
                    // Only intercept external hosts — never block the app's
                    // own dev URL (http://127.0.0.1:32830 / localhost) or the
                    // tauri.localhost / asset:// app origin, otherwise the
                    // shell would stop loading routes.
                    let is_app_origin = s.starts_with("http://127.0.0.1")
                        || s.starts_with("http://localhost")
                        || s.starts_with("https://127.0.0.1")
                        || s.starts_with("https://localhost");
                    if !is_app_origin {
                        if let Err(e) = open_url_in_os_browser(&s) {
                            log::warn!("on_navigation open_external_url failed: {e}");
                        }
                        return false;
                    }
                }
                true
            })
            .build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_cf_credentials,
            get_credentials,
            clear_stored_credentials,
            get_email_prefs,
            save_email_prefs,
            get_api_key_vault,
            save_api_key_vault_entry,
            remove_api_key_vault_entry_cmd,
            migrate_mail_user_folder,
            get_mail_json,
            save_mail_json,
            get_cache_json,
            save_cache_json,
            verify_cf_token,
            list_cf_zones,
            probe_routing_worker,
            adopt_routing_worker,
            install_routing_worker,
            update_routing_worker,
            save_license_key,
            save_relaybase_account,
            clear_relaybase_account,
            get_team_login,
            save_team_login_cmd,
            clear_team_login_cmd,
            auto_install_routing_worker,
            verify_worker_connection,
            save_worker_connection,
            get_desktop_info,
            open_external_url,
            open_local_file_with_default_app,
            save_download_file,
            open_file_path,
            reveal_file_in_folder,
            notify::show_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Relaybase desktop");
}
