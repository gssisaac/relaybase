mod cloudflare;
mod secrets;
mod worker;

use cloudflare::{list_zones, verify_token, ZoneSummary};
use secrets::{clear_credentials, load_credentials, save_credentials, StoredCredentials};
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
            verify_cf_token,
            list_cf_zones,
            probe_routing_worker,
            adopt_routing_worker,
            install_routing_worker,
            update_routing_worker,
            save_license_key,
            get_desktop_info,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Relaybase desktop");
}
