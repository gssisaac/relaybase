mod cloudflare;
mod secrets;
mod worker;

use cloudflare::{list_zones, verify_token, ZoneSummary};
use secrets::{
    clear_credentials, load_credentials, load_email_prefs,
    load_mail_json as read_mail_json, save_credentials,
    save_email_prefs as write_email_prefs, save_mail_json as write_mail_json, EmailPrefs,
    StoredCredentials,
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

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerConnectResult {
    ok: bool,
    product: String,
    worker_script_name: String,
    worker_url: String,
    r2_configured: bool,
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

/// Verify user-deployed Worker via GET /admin/connect (admin Bearer).
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

    let url = format!("{base}/admin/connect");
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
    let mut creds = load_credentials()?.unwrap_or_default();
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

/// Open https links in the system browser (webview <a target=_blank> is blocked).
#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
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
        Err("Opening external URLs is not supported on this platform".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_cf_credentials,
            get_credentials,
            clear_stored_credentials,
            get_email_prefs,
            save_email_prefs,
            get_mail_json,
            save_mail_json,
            verify_cf_token,
            list_cf_zones,
            probe_routing_worker,
            adopt_routing_worker,
            install_routing_worker,
            update_routing_worker,
            save_license_key,
            verify_worker_connection,
            save_worker_connection,
            get_desktop_info,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Relaybase desktop");
}
