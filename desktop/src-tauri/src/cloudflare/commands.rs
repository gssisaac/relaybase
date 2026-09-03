use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::client::{verify_token, TokenVerifyResult};
use super::loopback::{
    complete_cf_oauth_inner, start_cf_oauth_inner, OAuthStartResult,
};
use super::oauth::require_cf_oauth;
use super::worker::{
    adopt_worker, install_worker, probe_install, update_worker,
    InstallResult, ProbeResult,
};
use crate::auth::current_console_access_token;
use crate::storage::{
    load_credentials, load_credentials_merged, save_credentials, StoredCredentials,
};

#[tauri::command]
pub async fn verify_cf_token(
    account_id: String,
    api_token: String,
    scope: Option<String>,
) -> Result<TokenVerifyResult, String> {
    let s = scope.as_deref().unwrap_or("install");
    verify_token(account_id.trim(), api_token.trim(), s).await
}

#[tauri::command]
pub async fn probe_routing_worker() -> Result<ProbeResult, String> {
    let oauth = require_cf_oauth().await?;
    probe_install(&oauth.account_id, &oauth.access_token).await
}

#[tauri::command]
pub async fn adopt_routing_worker() -> Result<InstallResult, String> {
    let oauth = require_cf_oauth().await?;
    let creds = load_credentials()?.unwrap_or_default();
    let (result, next) = adopt_worker(&oauth.account_id, &oauth.access_token, &creds).await?;
    save_credentials(&next)?;
    Ok(result)
}

#[tauri::command]
pub async fn install_routing_worker(worker_js: Option<String>) -> Result<InstallResult, String> {
    let oauth = require_cf_oauth().await?;
    let creds = load_credentials()?.unwrap_or_default();
    let (result, next) =
        install_worker(&oauth.account_id, &oauth.access_token, worker_js, &creds).await?;
    save_credentials(&next)?;
    Ok(result)
}

#[tauri::command]
pub async fn update_routing_worker(worker_js: Option<String>) -> Result<InstallResult, String> {
    let oauth = require_cf_oauth().await?;
    let creds = load_credentials()?.unwrap_or_default();
    let mut next = creds;
    next.install_token = oauth.access_token;
    let result = update_worker(&next, worker_js).await?;
    Ok(result)
}

#[tauri::command]
pub async fn start_cf_oauth(
    app: tauri::AppHandle,
    purpose: Option<String>,
) -> Result<OAuthStartResult, String> {
    start_cf_oauth_inner(app, purpose).await
}

#[tauri::command]
pub async fn complete_cf_oauth(
    state: String,
    code: String,
) -> Result<StoredCredentials, String> {
    complete_cf_oauth_inner(state, code).await
}

/// Overlay credentials after ensuring the in-memory OAuth session is usable.
#[tauri::command]
pub async fn refresh_install_token() -> Result<StoredCredentials, String> {
    require_cf_oauth().await?;
    load_credentials_merged()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct D1BindingSnapshot {
    pub configured: bool,
    pub database_name: String,
    pub binding: String,
    pub size_bytes: Option<u64>,
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

fn default_d1_mail() -> D1BindingSnapshot {
    D1BindingSnapshot {
        configured: false,
        database_name: "relaybase-mail".into(),
        binding: "RELAYBASE_MAIL".into(),
        size_bytes: None,
    }
}

fn default_d1_app() -> D1BindingSnapshot {
    D1BindingSnapshot {
        configured: false,
        database_name: "relaybase-db".into(),
        binding: "RELAYBASE_DB".into(),
        size_bytes: None,
    }
}

fn parse_d1_binding(value: &Value, kind: &str) -> D1BindingSnapshot {
    let defaults = match kind {
        "logs" => default_d1_logs(),
        "mail" | "inboxIndex" => default_d1_mail(),
        _ => default_d1_app(),
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
                .get("mailConfigured")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            database_name: d1
                .get("mailDatabaseName")
                .and_then(|v| v.as_str())
                .unwrap_or("relaybase-mail")
                .into(),
            binding: "RELAYBASE_MAIL".into(),
            size_bytes: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerConnectResult {
    pub ok: bool,
    pub product: String,
    pub version: String,
    pub worker_script_name: String,
    pub worker_url: String,
    /// CF account id reported by the Worker (from CF_ACCOUNT_ID secret).
    pub account_id: String,
    pub r2_configured: bool,
    pub inbound_bucket_name: String,
    /// Sum of object sizes in the inbound R2 bucket (bytes). None if unknown.
    pub r2_total_bytes: Option<u64>,
    pub r2_object_count: Option<u64>,
    /// True when the Worker stopped scanning early (large bucket).
    pub r2_usage_truncated: Option<bool>,
    /// True when the Worker has a CF_API_TOKEN wrangler secret set.
    pub cf_api_token_set: bool,
    /// True when that secret passed a Cloudflare Zone Read probe.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cf_api_token_valid: Option<bool>,
    /// True when the Worker has a send_email EMAIL binding.
    #[serde(default)]
    pub email_binding_configured: bool,
    pub d1_logs: D1BindingSnapshot,
    pub d1_mail: D1BindingSnapshot,
    pub d1_app: D1BindingSnapshot,
}

pub fn normalize_worker_url(raw: &str) -> Result<String, String> {
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
    let mut mail_configured = false;

    if let Ok(res) = http
        .get(format!("{base}/health"))
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<Value>().await {
                if json.get("d1").is_some() {
                    logs_configured = json
                        .pointer("/d1/logsConfigured")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    mail_configured = json
                        .pointer("/d1/mailConfigured")
                        .and_then(|v| v.as_bool())
                        .or_else(|| {
                            json.pointer("/d1/inboxIndexConfigured")
                                .and_then(|v| v.as_bool())
                        })
                        .unwrap_or(false);
                    return (logs_configured, mail_configured);
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
            if let Ok(json) = res.json::<Value>().await {
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
            if let Ok(json) = res.json::<Value>().await {
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
                        mail_configured = search.status().as_u16() != 503;
                    }
                }
            }
        }
    }

    (logs_configured, mail_configured)
}

/// Backoff delays (seconds) between connect-check retries (~30s total).
const CONNECT_BACKOFF_SECS: &[u64] = &[2, 4, 8, 16];

async fn fetch_connect_with_retry(
    http: &reqwest::Client,
    url: &str,
    token: &str,
) -> Result<String, String> {
    for attempt in 0..=CONNECT_BACKOFF_SECS.len() {
        if attempt > 0 {
            tokio::time::sleep(tokio::time::Duration::from_secs(
                CONNECT_BACKOFF_SECS[attempt - 1],
            ))
            .await;
        }

        let res = match http
            .get(url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                if attempt < CONNECT_BACKOFF_SECS.len() {
                    continue;
                }
                return Err(format!(
                    "Could not reach Worker ({e}). Check the URL and your network."
                ));
            }
        };

        let status = res.status();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(
                "Unlock the console dashboard first (Touch ID or passtoken).".into(),
            );
        }
        if status.is_success() {
            return Ok(res.text().await.unwrap_or_default());
        }
        if attempt < CONNECT_BACKOFF_SECS.len() {
            continue;
        }
        return Err(format!(
            "Worker connect check failed (HTTP {}). Is this a Relaybase Worker URL?",
            status.as_u16()
        ));
    }
    Err("Worker connect check failed. Is this a Relaybase Worker URL?".into())
}

/// Verify user-deployed Worker via GET /console/connect (owner access Bearer).
#[tauri::command]
pub async fn verify_worker_connection(
    worker_url: String,
) -> Result<WorkerConnectResult, String> {
    let base = normalize_worker_url(&worker_url)?;
    let token = current_console_access_token()
        .unwrap_or_default();
    if token.is_empty() {
        return Err(
            "Unlock the console dashboard first (Touch ID or passtoken).".into(),
        );
    }

    let url = format!("{base}/console/connect");
    let http = reqwest::Client::new();
    let body = fetch_connect_with_retry(&http, &url, &token).await?;

    let value: Value =
        serde_json::from_str(&body).map_err(|_| {
            "Worker responded, but not with a Relaybase connect payload. Confirm you deployed the install package.".to_string()
        })?;

    if value.get("ok") != Some(&Value::Bool(true))
        || value.get("product").and_then(|v| v.as_str()) != Some("relaybase")
    {
        return Err(
            "This URL is reachable but does not look like a Relaybase Worker. Redeploy the install package."
                .into(),
        );
    }

    let usage = value.pointer("/inbound/usage");
    let mut d1_logs = parse_d1_binding(&value, "logs");
    let mut d1_mail = parse_d1_binding(&value, "mail");
    let d1_app = parse_d1_binding(&value, "app");

    if value.get("d1").is_none()
        && !d1_logs.configured
        && !d1_mail.configured
    {
        let (logs, mail) = probe_d1_when_connect_omits(&http, &base, &token).await;
        d1_logs.configured = logs;
        d1_mail.configured = mail;
    }

    Ok(WorkerConnectResult {
        ok: true,
        product: "relaybase".into(),
        version: value
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .into(),
        worker_script_name: value
            .get("workerScriptName")
            .and_then(|v| v.as_str())
            .unwrap_or("relaybase-api")
            .into(),
        worker_url: base,
        account_id: value
            .get("accountId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string(),
        r2_configured: value
            .pointer("/inbound/r2Configured")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        inbound_bucket_name: value
            .pointer("/inbound/bucketName")
            .and_then(|v| v.as_str())
            .unwrap_or("relaybase-mailbox")
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
        cf_api_token_set: value
            .get("cfApiTokenSet")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        cf_api_token_valid: value
            .get("cfApiTokenValid")
            .and_then(|v| v.as_bool()),
        email_binding_configured: value
            .get("emailBindingConfigured")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        d1_logs,
        d1_mail,
        d1_app,
    })
}

#[tauri::command]
pub async fn save_worker_connection(
    worker_url: String,
    worker_script_name: Option<String>,
    worker_version: Option<String>,
) -> Result<StoredCredentials, String> {
    let base = normalize_worker_url(&worker_url)?;
    // Prefer merging into existing creds, but never block a successful verify
    // on a legacy/unreadable workspace.json — overwrite with what we know.
    let mut creds = match load_credentials() {
        Ok(existing) => existing.unwrap_or_default(),
        Err(e) => {
            log::warn!("load_credentials failed during save_worker_connection: {e}");
            StoredCredentials::default()
        }
    };
    creds.worker_url = base;
    creds.worker_script_name = worker_script_name
        .unwrap_or_default()
        .trim()
        .to_string();
    if creds.worker_script_name.is_empty() {
        creds.worker_script_name = "relaybase-api".into();
    }
    if let Some(version) = worker_version {
        let v = version.trim();
        if !v.is_empty() {
            creds.worker_version = v.to_string();
        }
    }
    save_credentials(&creds)?;
    load_credentials_merged()
}
