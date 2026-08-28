use tauri::AppHandle;

use super::errors::format_worker_http_error;
use super::log::emit_log;
use super::types::InitDbResult;

fn is_transient_schema_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("1042")
        || lower.contains("404")
        || lower.contains("1101")
        || lower.contains("1104")
        || lower.contains("not found")
        || lower.contains("401")
        || lower.contains("unauthorized")
}

pub(crate) async fn init_worker_db_with_retry(
    app: &AppHandle,
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
) -> Result<InitDbResult, String> {
    const ATTEMPTS: u32 = 4;
    let mut last = String::new();
    for attempt in 1..=ATTEMPTS {
        match init_worker_db(worker_url, pepper, access_token).await {
            Ok(r) => return Ok(r),
            Err(e) => {
                last = e;
                if attempt == ATTEMPTS || !is_transient_schema_error(&last) {
                    break;
                }
                emit_log(
                    app,
                    "init-db",
                    "info",
                    format!("init-db not ready yet (attempt {attempt}/{ATTEMPTS}) — retrying…"),
                );
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
        }
    }
    Err(last)
}

pub(crate) async fn migrate_worker_db_with_retry(
    app: &AppHandle,
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
) -> Result<InitDbResult, String> {
    const ATTEMPTS: u32 = 4;
    let mut last = String::new();
    for attempt in 1..=ATTEMPTS {
        match migrate_worker_db(worker_url, pepper, access_token).await {
            Ok(r) => return Ok(r),
            Err(e) => {
                last = e;
                if attempt == ATTEMPTS || !is_transient_schema_error(&last) {
                    break;
                }
                emit_log(
                    app,
                    "migrate-db",
                    "info",
                    format!("migrate-db not ready yet (attempt {attempt}/{ATTEMPTS}) — retrying…"),
                );
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
        }
    }
    Err(last)
}

async fn post_schema_endpoint(
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
    path: &str,
    step: &str,
) -> Result<InitDbResult, String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Worker URL is empty".into());
    }
    let url = format!("{base}{path}");
    let client = reqwest::Client::new();
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({}));
    if let Some(token) = access_token.filter(|s| !s.trim().is_empty()) {
        req = req.header("Authorization", format!("Bearer {}", token.trim()));
    } else if let Some(p) = pepper.filter(|s| !s.trim().is_empty()) {
        req = req.header("X-Auth-Pepper", p.trim());
    } else {
        return Err(format!("{step} requires an owner session or AUTH_PEPPER"));
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("{step} request failed: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format_worker_http_error(step, status, &text));
    }
    res.json::<InitDbResult>()
        .await
        .map_err(|e| format!("{step} response parse failed: {e}"))
}

/// Empty D1 only. Fails with 409 if product tables already exist.
pub async fn init_worker_db(
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
) -> Result<InitDbResult, String> {
    post_schema_endpoint(worker_url, pepper, access_token, "/console/init-db", "init-db").await
}

/// Pending migrations only. Never drops tables.
pub async fn migrate_worker_db(
    worker_url: &str,
    pepper: Option<&str>,
    access_token: Option<&str>,
) -> Result<InitDbResult, String> {
    post_schema_endpoint(worker_url, pepper, access_token, "/console/migrate-db", "migrate-db").await
}
